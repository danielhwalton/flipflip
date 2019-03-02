import IncomingMessage = Electron.IncomingMessage;
import * as React from 'react';
import request from 'request';
import fs from "fs";
import {outputFile} from "fs-extra";
import wretch from "wretch";
import gifInfo from 'gif-info';
import getFolderSize from "get-folder-size";


import {BT, HTF, IF, ST, TF, VTF, ZF} from '../../const';
import {getCachePath, getFileName, getRandomListItem, getSourceType, urlToPath} from '../../utils';
import Config from "../../Config";
import TIMING_FUNCTIONS from '../../TIMING_FUNCTIONS';
import ChildCallbackHack from './ChildCallbackHack';
import ImageView from './ImageView';

class GifInfo {
  animated: boolean;
  duration: string;
}

export default class ImagePlayer extends React.Component {
  readonly props: {
    config: Config,
    advanceHack?: ChildCallbackHack,
    deleteHack?: ChildCallbackHack,
    maxInMemory: number,
    maxLoadingAtOnce: number,
    maxToRememberInHistory: number,
    allURLs: Map<String, Array<string>>,
    isPlaying: boolean,
    timingFunction: string,
    timingConstant: string,
    zoomType: string,
    backgroundType: string;
    backgroundColor: string;
    strobe: boolean;
    strobeTime: number;
    strobeColor: string;
    effectLevel: number,
    horizTransType: string,
    vertTransType: string,
    imageTypeFilter: string,
    historyOffset: number,
    fadeEnabled: boolean,
    playFullGif: boolean;
    imageSizeMin: number,
    setHistoryPaths: (historyPaths: Array<HTMLImageElement>) => void,
    setHistoryOffset: (historyOffset: number) => void,
    onLoaded: () => void,
  };

  readonly state = {
    numBeingLoaded: 0,
    readyToDisplay: Array<HTMLImageElement>(),
    historyPaths: Array<HTMLImageElement>(),
    timeToNextFrame: 0,
    timeoutID: 0,
    nextImageID: 0,
    restart: false,
  };

  _isMounted = false;

  render() {
    if (this.state.historyPaths.length < 1) return <div className="ImagePlayer m-empty"/>;

    const imgs = Array<HTMLImageElement>();

    // if user is browsing history, use that image instead
    if (this.state.historyPaths.length > 0 && !this.props.isPlaying) {
      let offset = this.props.historyOffset;
      if (offset <= -this.state.historyPaths.length) {
        offset = -this.state.historyPaths.length + 1;
      }
      const img = this.state.historyPaths[(this.state.historyPaths.length - 1) + offset];
      (img as any).key = 0;
      imgs.push(img);
    } else {
      const max = this.props.fadeEnabled ? 3 : 2;
      for (let i = 1; i < max; i++) {
        const img = this.state.historyPaths[this.state.historyPaths.length - i];
        if (img) {
          imgs.push(img);
        }
      }
    }

    let className = "ImagePlayer translate-";

    switch (this.props.horizTransType) {
      case HTF.none:
        className += '0-';
        break;
      case HTF.right:
        className += '10-';
        break;
      case HTF.left:
        className += '-10-';
        break;
    }
    switch (this.props.vertTransType) {
      case VTF.none:
        className += '0-';
        break;
      case VTF.down:
        className += '10-';
        break;
      case VTF.up:
        className += '-10-';
        break;
    }
    switch (this.props.zoomType) {
      case ZF.none:
        className += `${this.props.effectLevel}s`;
        break;
      case ZF.in:
        className += `zoom-${this.props.effectLevel}s`;
        break;
      case ZF.out:
        className += `zoom-out-${this.props.effectLevel}s`;
    }

    return (
      <div className={className} style={{
        background: this.props.strobe ? this.props.strobeColor : "none",
      }}>
        <div style={{ animation: this.props.strobe ? "strobe " + this.props.strobeTime + "ms steps(1, end) infinite" : "none" }}>
          <div className={`u-fill-container ${this.props.backgroundType == BT.color ? '' : 'u-fill-image-blur'}`} style={{
            background: this.props.backgroundType == BT.color ? this.props.backgroundColor : null,
            backgroundImage: this.props.backgroundType == BT.color ? null : `url("${imgs[0].src}")`,
          }}
          />
          {imgs.map((img) => {
            return <ImageView
              img={img}
              key={(img as any).key}
              fadeState={this.props.fadeEnabled ? (img.src === imgs[0].src ? 'in' : 'out') : 'none'}
              fadeDuration={this.state.timeToNextFrame / 2}/>;
          })}
        </div>
      </div>
    );
  }

  componentDidMount() {
    this._isMounted = true;
    if (this.props.advanceHack) {
      this.props.advanceHack.listener = () => {
        // advance, ignoring isPlaying status and not scheduling another
        this.advance(false, false, true);
      }
    }
    if (this.props.deleteHack) {
      this.props.deleteHack.listener = () => {
        // delete current image from historyPaths and readyToDisplay
        this.delete();
      }
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.props.advanceHack) {
      this.props.advanceHack.listener = null;
    }
  }

  componentWillReceiveProps(props: any) {
    if ((!this.props.isPlaying && props.isPlaying) || this.state.restart) {
      this.setState({restart: false});
      this.start();
    } else if (!props.isPlaying && this.state.timeoutID != 0) {
      clearTimeout(this.state.timeoutID);
      this.setState({timeoutID: 0});
    } else if (this.props.allURLs == null && props.allURLs != null && props.allURLs.size > 0) {
      // Can't just call start again, because props won't have been updated yet,
      // but flag to restart next time props are updated
      this.setState({restart: true});
    }
  }

  delete() {
    const img = this.state.historyPaths[(this.state.historyPaths.length - 1) + this.props.historyOffset];
    const url = img.src;
    let newHistoryPaths = [];
    let newHistoryOffset = this.props.historyOffset;
    for (let image of this.state.historyPaths) {
      if (image.src != url) {
        newHistoryPaths.push(image);
      } else {
        newHistoryOffset += 1;
      }
    }
    if (newHistoryOffset > 0) {
      newHistoryOffset = 0;
    }
    this.props.setHistoryPaths(newHistoryPaths);
    this.props.setHistoryOffset(newHistoryOffset);
    this.setState({
      historyPaths: newHistoryPaths,
      historyOffset: newHistoryOffset,
      readyToDisplay: this.state.readyToDisplay.filter((i) => i.src != url),
    });
  }

  start() {
    if (this.props.allURLs == null) {
      this.props.onLoaded();
      return;
    }

    for (let i = 0; i < this.props.maxLoadingAtOnce; i++) {
      this.runFetchLoop(i, true);
    }

    this.advance(true, true);
  }

  runFetchLoop(i: number, isStarting = false) {
    if (!this._isMounted && !isStarting) return;

    const source = getRandomListItem(Array.from(this.props.allURLs.keys()));
    const collection = this.props.allURLs.get(source);

    if (this.state.readyToDisplay.length >= this.props.maxLoadingAtOnce ||
      !(collection && collection.length)) {
      // Wait for the display loop to use an image (it might be fast, or paused)
      setTimeout(() => this.runFetchLoop(i), 100);
      return;
    }
    const url = getRandomListItem(collection);
    const img = new Image();
    img.setAttribute("source", source);

    this.setState({numBeingLoaded: this.state.numBeingLoaded + 1});

    const successCallback = () => {
      if (!this._isMounted) return;
      if (this.props.onLoaded && this.state.historyPaths.length == 1) {
        this.props.onLoaded();
      }
      (img as any).key = this.state.nextImageID;
      this.setState({
        readyToDisplay: this.state.readyToDisplay.concat([img]),
        numBeingLoaded: Math.max(0, this.state.numBeingLoaded - 1),
        nextImageID: this.state.nextImageID + 1,
      });
      if (this.state.historyPaths.length === 0) {
        this.advance(false, false);
      }
      this.runFetchLoop(i);
    };

    const errorCallback = () => {
      if (!this._isMounted) return;
      this.setState({
        numBeingLoaded: Math.max(0, this.state.numBeingLoaded - 1),
      });
      setTimeout(this.runFetchLoop.bind(this, i), 0);
    };

    function toArrayBuffer(buf: Buffer) {
      let ab = new ArrayBuffer(buf.length);
      let view = new Uint8Array(ab);
      for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
      }
      return ab;
    }

    img.onload = () => {
      // images may load immediately, but that messes up the setState()
      // lifecycle, so always load on the next event loop iteration.
      // Also, now  we know the image size, so we can finally filter it.
      if (img.width < this.props.imageSizeMin || img.height < this.props.imageSizeMin) {
        setTimeout(errorCallback, 0);
      } else {
        if (this.props.config.caching.enabled) {
          const fileType = getSourceType(img.src);
          if (fileType != ST.local) {
            const cachePath = getCachePath(null, this.props.config);
            if (!fs.existsSync(cachePath)) {
              fs.mkdirSync(cachePath)
            }
            const maxSize = this.props.config.caching.maxSize;
            const sourceCachePath = getCachePath(img.getAttribute("source"), this.props.config);
            const filePath = sourceCachePath + getFileName(img.src);
            const downloadImage = () => {
              if (!fs.existsSync(filePath)) {
                wretch(img.src)
                  .get()
                  .blob(blob => {
                    const reader = new FileReader();
                    reader.onload = function () {
                      if (reader.readyState == 2) {
                        const arrayBuffer = reader.result as ArrayBuffer;
                        const buffer = Buffer.alloc(arrayBuffer.byteLength);
                        const view = new Uint8Array(arrayBuffer);
                        for (let i = 0; i < arrayBuffer.byteLength; ++i) {
                          buffer[i] = view[i];
                        }
                        outputFile(filePath, buffer);
                      }
                    };
                    reader.readAsArrayBuffer(blob);
                  });
              }
            };
            if (maxSize == 0) {
              downloadImage();
            } else {
              getFolderSize(cachePath, (err: string, size: number) => {
                if (err) {
                  throw err;
                }

                const mbSize = (size / 1024 / 1024);
                if (mbSize < maxSize) {
                  downloadImage();
                }
              });
            }
          }
        }
        setTimeout(successCallback, 0);
      }
    };

    img.onerror = () => {
      setTimeout(errorCallback, 0);
    };

    const processInfo = (info: GifInfo) => {
      // If gif is animated and we want to play entire length, store its duration
      if (this.props.playFullGif && info && info.animated) {
        img.setAttribute("duration", info.duration);
      }

      // Exclude non-animated gifs from gifs
      if (this.props.imageTypeFilter == IF.gifs && info && !info.animated) {
        this.runFetchLoop(i);
        return;
        // Exclude animated gifs from stills
      } else if (this.props.imageTypeFilter == IF.stills && info && info.animated) {
        this.runFetchLoop(i);
        return;
      }

      img.src = url;
    };

    // Filter gifs by animation
    if (url.toLocaleLowerCase().endsWith('.gif')) {
      // Get gif info. See https://github.com/Prinzhorn/gif-info
      try {
        if (url.includes("file:///")) {
          processInfo(gifInfo(toArrayBuffer(fs.readFileSync(urlToPath(url)))));
        } else {
          request.get({url, encoding: null}, function (err: Error, res: IncomingMessage, body: Buffer) {
            if (err) {
              console.error(err);
              return;
            }
            processInfo(gifInfo(toArrayBuffer(body)));
          });
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      img.src = url;
    }
  }

  advance(isStarting = false, schedule = true, ignoreIsPlayingStatus = false) {
    let nextHistoryPaths = this.state.historyPaths;
    let nextImg: HTMLImageElement;
    if (this.state.readyToDisplay.length) {
      nextImg = this.state.readyToDisplay.shift();
      nextHistoryPaths = nextHistoryPaths.concat([nextImg]);
    } else if (this.state.historyPaths.length) {
      // no new image ready; just pick a random one from the past 120
      nextImg = getRandomListItem(this.state.historyPaths);
      nextHistoryPaths = nextHistoryPaths.concat([nextImg]);
    }
    while (nextHistoryPaths.length > this.props.maxInMemory) {
      nextHistoryPaths.shift();
    }

    // bail if dead
    if (!(isStarting || ignoreIsPlayingStatus || (this.props.isPlaying && this._isMounted))) return;

    this.setState({
      historyPaths: nextHistoryPaths,
    });
    this.props.setHistoryPaths(nextHistoryPaths);

    if (!schedule) return;

    let timeToNextFrame: number = 0;
    if (this.props.timingFunction === TF.constant) {
      timeToNextFrame = parseInt(this.props.timingConstant, 10);
      // If we cannot parse this, default to 1s
      if (!timeToNextFrame && timeToNextFrame != 0) {
        timeToNextFrame = 1000;
      }
    } else {
      timeToNextFrame = TIMING_FUNCTIONS.get(this.props.timingFunction)();
    }
    if (nextImg && nextImg.getAttribute("duration") && timeToNextFrame < parseInt(nextImg.getAttribute("duration"))) {
      timeToNextFrame = parseInt(nextImg.getAttribute("duration"));
    }
    this.setState({
      timeToNextFrame,
      timeoutID: setTimeout(this.advance.bind(this, false, true), timeToNextFrame),
    });
  }
};
