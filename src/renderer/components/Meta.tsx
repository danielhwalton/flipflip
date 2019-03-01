import {remote} from 'electron';
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'fs';
import * as fs from "fs";
import * as React from 'react';
import path from 'path';

import {getBackups, removeDuplicatesBy, saveDir} from "../utils";
import Config from "../Config";
import Scene from '../Scene';
import ScenePicker from './ScenePicker';
import ConfigForm from './config/ConfigForm';
import Library from './library/Library';
import LibrarySource from './library/LibrarySource';
import Tag from "./library/Tag";
import TagManager from "./library/TagManager";
import SceneGenerator from "./library/SceneGenerator";
import Player from './player/Player';
import SceneDetail from './sceneDetail/SceneDetail';

/**
 * A compile-time global variable defined in webpack.config'
 *  [plugins] section to pick up the version string from 
 *   package.json
 */
declare var __VERSION__: string;

class Route {
  kind: string;
  value: any;

  constructor(init?: Partial<Route>) {
    Object.assign(this, init);
  }
}

// initialState declaration (overwritten by data read from data.json)
let initialState = {
  version: __VERSION__,
  config: new Config(),
  scenes: Array<Scene>(),
  library: Array<LibrarySource>(),
  tags: Array<Tag>(),
  route: Array<Route>(),
  autoEdit: false,
  isSelect: false,
  libraryYOffset: 0,
  libraryFilters: Array<string>(),
};

try {
  mkdirSync(saveDir);
} catch (e) {
  // who cares
}
const savePath = path.join(saveDir, 'data.json');
console.log("Saving to", savePath);

try {
  const data = JSON.parse(readFileSync(savePath, 'utf-8'));
  switch (data.version) {
    // When no version number found in data.json -- assume pre-v2.0.0 format
    // This should fail safe and self heal.
    case undefined:
      // Preserve the existing file - so as not to destroy user's data
      archiveFile(savePath);

      // Create Library from aggregate of previous scenes' directories
      let sources = Array<string>();
      for (let scene of data.scenes) {
        sources = sources.concat(scene.directories);
      }
      sources = removeDuplicatesBy((s: string) => s, sources);

      // Create our initialState object
      initialState = {
        version: __VERSION__,
        autoEdit: data.autoEdit,
        isSelect: data.isSelect ? data.isSelect : false,
        config: data.config ? data.config : new Config(),
        scenes: Array<Scene>(),
        library: Array<LibrarySource>(),
        tags: Array<Tag>(),
        route: data.route.map((s: any) => new Route(s)),
        libraryYOffset: 0,
        libraryFilters: Array<string>(),
      };

      // Hydrate and add the library ! Yay!!! :)
      let libraryID = 0;
      const newLibrarySources = Array<LibrarySource>();
      for (let url of sources) {
        newLibrarySources.push(new LibrarySource({
          url: url,
          id: libraryID,
          tags: Array<Tag>(),
        }));
        libraryID += 1;
      }
      initialState.library = newLibrarySources;

      // Convert and add old scenes
      const newScenes = Array<Scene>();
      for (let oldScene of data.scenes) {
        const newScene = new Scene(oldScene);

        let sourceID = 0;
        const sources = Array<LibrarySource>();
        for (let oldDirectory of oldScene.directories) {
          sources.push(new LibrarySource({
            url: oldDirectory,
            id: sourceID,
            tags: Array<Tag>(),
          }));
          sourceID += 1;
        }
        newScene.sources = sources;
        newScenes.push(newScene);
      }
      initialState.scenes = newScenes;
      break;
    default:
      initialState = {
        version: __VERSION__,
        autoEdit: data.autoEdit,
        isSelect: data.isSelect,
        config: data.config,
        scenes: data.scenes.map((s: any) => new Scene(s)),
        library: data.library.map((s: any) => new LibrarySource(s)),
        tags: data.tags.map((t: any) => new Tag(t)),
        route: data.route.map((s: any) => new Route(s)),
        libraryYOffset: 0,
        libraryFilters: Array<string>(),
      };
  }
} catch (e) {
  // When an error occurs archive potentially incompatible data.json file 
  // This essentially renames the data.json file and thus the app is self-healing
  // in that it will recreate an initial (blank) data.json file on restarting
  // - The archived file being available for investigation.
  console.error(e);
  archiveFile(savePath);
}

/**
 * Archives a file (if it exists) to same path appending '.{epoch now}' 
 * to the file name 
 * @param {string} filePath 
 */
function archiveFile(filePath: string): void {
  if (existsSync(filePath)) {
    renameSync(filePath, (filePath + '.' + Date.now()));
  }
}

export default class Meta extends React.Component {
  readonly state = initialState;

  isRoute(kind: string): Boolean {
    if (this.state.route.length < 1) return false;
    return this.state.route[this.state.route.length - 1].kind === kind;
  }

  scene?(): Scene {
    for (let r of this.state.route.slice().reverse()) {
      if (r.kind == 'scene' || r.kind == 'generate') {
        return this.state.scenes.find((s) => s.id === r.value);
      }
    }
    return null;
  }

  librarySource?(): LibrarySource {
    const libraryID = this.scene().libraryID;
    for (let s of this.state.library) {
      if (s.id == libraryID) {
        return s;
      }
    }
    return null;
  }

  overlayScene?(): Scene {
    if (!this.scene()) return null;
    if (!this.scene().overlaySceneID) return null;
    return this.state.scenes.filter((s) => {
      return s.id === this.scene().overlaySceneID;
    })[0];
  }

  componentDidMount() {
    setInterval(this.save.bind(this), 500);
  }

  render() {
    return (
      <div className="Meta">
        {this.state.route.length === 0 && (
          <ScenePicker
            scenes={this.state.scenes}
            version={this.state.version}
            libraryCount={this.state.library.length}
            onUpdateScenes={this.onUpdateScenes.bind(this)}
            onAdd={this.onAddScene.bind(this)}
            onImport={this.onImport.bind(this)}
            onSelect={this.onOpenScene.bind(this)}
            onOpenLibrary={this.onOpenLibrary.bind(this)}
            onGenerate={this.onAddGenerator.bind(this)}
            onConfig={this.onConfig.bind(this)}
            canGenerate={this.state.library.length > 0 && this.state.tags.length > 0}
          />
        )}

        {this.isRoute('library') && (
          <Library
            library={this.state.library}
            tags={this.state.tags}
            isSelect={this.state.isSelect}
            yOffset={this.state.libraryYOffset}
            filters={this.state.libraryFilters}
            onPlay={this.onPlaySceneFromLibrary.bind(this)}
            onUpdateLibrary={this.onUpdateLibrary.bind(this)}
            goBack={this.goBack.bind(this)}
            manageTags={this.manageTags.bind(this)}
            importSources={this.onImportFromLibrary.bind(this)}
          />
        )}

        {this.isRoute('tags') && (
          <TagManager
            tags={this.state.tags}
            onUpdateTags={this.onUpdateTags.bind(this)}
            goBack={this.goBack.bind(this)}
          />
        )}

        {this.isRoute('generate') && (
          <SceneGenerator
            library={this.state.library}
            tags={this.state.tags}
            autoEdit={this.state.autoEdit}
            scene={this.scene()}
            goBack={this.goBack.bind(this)}
            onGenerate={this.onGenerateScene.bind(this)}
            onUpdateScene={this.onUpdateScene.bind(this)}
            onDelete={this.onDeleteScene.bind(this)}
          />
        )}

        {this.isRoute('scene') && (
          <SceneDetail
            scene={this.scene()}
            allScenes={this.state.scenes}
            autoEdit={this.state.autoEdit}
            goBack={this.goBack.bind(this)}
            onExport={this.onExport.bind(this)}
            onDelete={this.onDeleteScene.bind(this)}
            onPlay={this.onPlayScene.bind(this)}
            onUpdateScene={this.onUpdateScene.bind(this)}
            onOpenLibraryImport={this.onOpenLibraryImport.bind(this)}
            saveScene={this.saveScene.bind(this)}
          />
        )}

        {this.isRoute('play') && (
          <Player
            config={this.state.config}
            scene={this.scene()}
            onUpdateScene={this.onUpdateScene.bind(this)}
            overlayScene={this.overlayScene()}
            goBack={this.goBack.bind(this)}
          />
        )}

        {this.isRoute('libraryplay') && (
          <Player
            config={this.state.config}
            scene={this.scene()}
            onUpdateScene={this.onUpdateScene.bind(this)}
            goBack={this.endPlaySceneFromLibrary.bind(this)}
            tags={this.librarySource().tags}
            allTags={this.state.tags}
            toggleTag={this.onToggleTag.bind(this)}
          />
        )}

        {this.isRoute('config') && (
          <ConfigForm
            config={this.state.config}
            scenes={this.state.scenes}
            goBack={this.goBack.bind(this)}
            updateConfig={this.updateConfig.bind(this)}
            onDefault={this.onDefaultConfig.bind(this)}
            onBackup={this.backup.bind(this)}
            onRestore={this.restore.bind(this)}
            onClean={this.cleanBackups.bind(this)}
          />
        )}
      </div>
    )
  }

  save() {
    writeFileSync(savePath, JSON.stringify(this.state), 'utf-8');
  }

  backup() {
    try {
      archiveFile(savePath);
    } catch (e) {
      alert("Backup error:\n" + e);
      return;
    }
    alert("Backup success!");
  }

  restore(backupFile: string) {
    try {
      const data = JSON.parse(readFileSync(backupFile, 'utf-8'));
      this.setState({
        version: data.version,
        autoEdit: data.autoEdit,
        isSelect: data.isSelect,
        config: data.config,
        scenes: data.scenes.map((s: any) => new Scene(s)),
        library: data.library.map((s: any) => new LibrarySource(s)),
        tags: data.tags.map((t: any) => new Tag(t)),
        route: data.route.map((s: any) => new Route(s)),
        libraryYOffset: 0,
        libraryFilters: Array<string>(),
      });
    } catch (e) {
      alert("Restore error:\n" + e);
      return;
    }
    alert("Restore success!");
  }

  cleanBackups() {
    const backups = getBackups();
    backups.shift(); // Keep the newest backup
    let error;
    for (let backup of backups) {
      fs.unlink(saveDir + path.sep + backup, (err) => {
        if (err) {
          error = err;
        }
      });
    }
    if (error) {
      alert("Cleanup error:\n" + error);
    } else {
      alert("Cleanup success!");
    }
  }

  goBack() {
    const newRoute = this.state.route;
    this.state.route.pop();
    this.setState({route: newRoute, autoEdit: false, isSelect: false});
  }

  saveScene() {
    let id = this.state.scenes.length + 1;
    this.state.scenes.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });
    const sceneCopy = JSON.parse(JSON.stringify(this.scene())); // Make a copy
    sceneCopy.tagWeights = null;
    sceneCopy.id = id;
    this.setState({
      scenes: this.state.scenes.concat([sceneCopy]),
      route: [new Route({kind: 'scene', value: sceneCopy.id})],
      autoEdit: true,
    });
  }

  onAddScene() {
    let id = this.state.scenes.length + 1;
    this.state.scenes.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });
    let scene = new Scene({
      id: id,
      name: "New scene",
      sources: new Array<LibrarySource>(),
      ...this.state.config.defaultScene,
    });
    this.setState({
      scenes: this.state.scenes.concat([scene]),
      route: [new Route({kind: 'scene', value: scene.id})],
      autoEdit: true,
    });
  }

  onDeleteScene(scene: Scene) {
    this.setState({
      scenes: this.state.scenes.filter((s) => s.id != scene.id),
      route: [],
    });
  }

  updateConfig(newConfig: Config) {
    this.setState({config: newConfig});
  }

  onConfig() {
    this.setState({route: [new Route({kind: 'config', value: null})]});
  }

  onDefaultConfig() {
    this.setState({config: new Config(), route: []});
  }

  onOpenScene(scene: Scene) {
    if (scene.tagWeights) {
      this.setState({route: [new Route({kind: 'generate', value: scene.id})]});
    } else {
      this.setState({route: [new Route({kind: 'scene', value: scene.id})]});
    }
  }

  onOpenLibrary() {
    this.setState({route: [new Route({kind: 'library', value: null})], libraryYOffset: 0, libraryFilters: Array<string>()});
  }

  onOpenLibraryImport() {
    this.setState({route: this.state.route.concat(new Route({kind: 'library', value: null})), isSelect: true});
  }

  onImportFromLibrary(sources: Array<string>) {
    const sceneSources = this.scene().sources;
    const sceneSourceURLs = sceneSources.map((s) => s.url);
    let id = sceneSources.length + 1;
    this.scene().sources.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });
    for (let source of sources) {
      if (!sceneSourceURLs.includes(source)) {
        const newSource = new LibrarySource({
          url: source,
          id: id,
          tags: new Array<Tag>(),
        });
        sceneSources.push(newSource);
        id += 1;
      }
    }
    this.onUpdateScene(this.scene(), (s) => {s.sources = sceneSources;});
    this.goBack();
  }

  onPlayScene(scene: Scene) {
    this.setState({route: this.state.route.concat(new Route({kind: 'play', value: scene.id}))});
  }

  onPlaySceneFromLibrary(source: LibrarySource, yOffset: number, filters: Array<string>) {
    let id = this.state.scenes.length + 1;
    this.state.scenes.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });
    let tempScene = new Scene({
      name: "library_scene_temp",
      sources: [source],
      libraryID: source.id,
      id: id,
    });
    const newRoute = [new Route({kind: 'scene', value: tempScene.id}), new Route({kind: 'libraryplay', value: tempScene.id})];
    this.setState({
      scenes: this.state.scenes.concat([tempScene]),
      route: newRoute,
      libraryYOffset: yOffset,
      libraryFilters: filters,
    });
  }

  endPlaySceneFromLibrary() {
    const newScenes = this.state.scenes;
    const libraryID = newScenes.pop().libraryID;
    const tagNames = this.state.tags.map((t) => t.name);
    // Re-order the tags of the source we were playing
    const newLibrary = this.state.library.map((s) => {
      if (s.id == libraryID) {
         s.tags = s.tags.sort((a, b) => {
          const aIndex = tagNames.indexOf(a.name);
          const bIndex = tagNames.indexOf(b.name);
          if (aIndex < bIndex) {
            return -1;
          } else if (aIndex > bIndex) {
            return 1;
          } else {
            return 0;
          }
        });
      }
      return s;
    });
    this.setState({route: [new Route({kind: 'library'})], scenes: newScenes, library: newLibrary});
  }

  manageTags() {
    const newRoute = this.state.route.concat(new Route({kind: 'tags', value: null}));
    this.setState({route: newRoute});
  }

  onAddGenerator() {
    let id = this.state.scenes.length + 1;
    this.state.scenes.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });
    let scene = new Scene({
      id: id,
      name: "New generator",
      sources: new Array<LibrarySource>(),
      tagWeights: "[]",
      ...this.state.config.defaultScene,
    });
    this.setState({
      scenes: this.state.scenes.concat([scene]),
      route: [new Route({kind: 'generate', value: scene.id})],
      autoEdit: true
    });
  }

  onGenerateScene() {
    const newRoute = this.state.route.concat(new Route({kind: 'scene', value: this.scene().id}));
    this.setState({route: newRoute});
  }

  onUpdateScene(scene: Scene, fn: (scene: Scene) => void) {
    const scenes = this.state.scenes;
    for (let s of scenes) {
      if (s.id == scene.id) {
        fn(s);
      }
    }
    this.setState({scenes: scenes});
  }

  onUpdateScenes(scenes: Array<Scene>) {
    this.setState({scenes: scenes});
  }

  onUpdateLibrary(library: Array<LibrarySource>) {
    this.setState({library: library});
  }

  onUpdateTags(tags: Array<Tag>) {
    // Go through each scene in the library
    let newLibrary = this.state.library;
    const tagIDs = tags.map((t) => t.id);
    for (let source of newLibrary) {
      // Remove deleted tags, update any edited tags, and order the same as tags
      source.tags = source.tags.filter((t) => tagIDs.includes(t.id));
      source.tags = source.tags.map((t) => {
        for (let tag of tags) {
          if (t.id == tag.id) {
            t.name = tag.name;
            return t;
          }
        }
      });
      source.tags = source.tags.sort((a, b) => {
        const aIndex = tagIDs.indexOf(a.id);
        const bIndex = tagIDs.indexOf(b.id);
        if (aIndex < bIndex) {
          return -1;
        } else if (aIndex > bIndex) {
          return 1;
        } else {
          return 0;
        }
      });
    }
    this.setState({tags: tags, library: newLibrary});
  }

  onToggleTag(sourceID: number, tag: Tag) {
    let newLibrary = this.state.library;
    for (let source of newLibrary) {
      if (source.id == sourceID) {
        if (source.tags.map((t) => t.name).includes(tag.name)) {
          source.tags = source.tags.filter((t) => t.name != tag.name);
        } else {
          source.tags.push(tag);
        }
      }
    }
    this.onUpdateLibrary(newLibrary);
  }

  onExport(scene: Scene) {
    const sceneCopy = JSON.parse(JSON.stringify(scene)); // Make a copy
    sceneCopy.tagWeights = null;
    const sceneExport = JSON.stringify(sceneCopy);
    const fileName = sceneCopy.name + "_export.json";
    remote.dialog.showSaveDialog(remote.getCurrentWindow(),
      {filters: [{name: 'JSON Document', extensions: ['json']}], defaultPath: fileName}, (filePath) => {
        if (filePath != null) {
          fs.writeFileSync(filePath, sceneExport);
        }
    });
  }

  onImport() {
    const filePath = remote.dialog.showOpenDialog(remote.getCurrentWindow(),
      {filters: [{name:'All Files (*.*)', extensions: ['*']},{name: 'JSON Document', extensions: ['json']}], properties: ['openFile']});
    if (!filePath || !filePath.length) return;
    const scene = new Scene(JSON.parse(readFileSync(filePath[0], 'utf-8')));
    let id = this.state.scenes.length + 1;
    this.state.scenes.forEach((s) => {
      id = Math.max(s.id + 1, id);
    });
    scene.id = id;
    this.setState({scenes: this.state.scenes.concat([scene]), route: [new Route({kind: 'scene', value: scene.id})]});
  }
};
