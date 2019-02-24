import {BT, HTF, IF, TF, VTF, ZF} from "./const";

export class SceneSettings {
  timingFunction = TF.constant;
  timingConstant = "1000";
  imageTypeFilter = IF.any;
  zoomType = ZF.none;
  effectLevel = 5;
  horizTransType = HTF.none;
  vertTransType = VTF.none;
  crossFade = false;
  backgroundType = BT.blur;
  backgroundColor = "#000000";
  playFullGif = false;
  overlaySceneID = 0;
  overlaySceneOpacity = 0.5;
  textKind = "";
  textSource = "";

  strobe = false;
  strobeTime = 200;
  strobeColor = "#FFFFFF";

  blinkColor = "#FFFFFF";
  blinkFontSize = 20;
  blinkFontFamily = "Arial Black,Arial Bold,Gadget,sans-serif";

  captionColor = "#FFFFFF";
  captionFontSize = 8;
  captionFontFamily = "Helvetica Neue,Helvetica,Arial,sans-serif";

  captionBigColor = "#FFFFFF";
  captionBigFontSize = 12;
  captionBigFontFamily = "Arial Black,Arial Bold,Gadget,sans-serif";
}

export class RemoteSettings {
  tumblrDefault = "BaQquvlxQeRhKRyViknF98vseIdcBEyDrzJBpHxvAiMPHCKR2l";
  tumblrOverlay = "G4iZd6FBiyDxHVUpNqtOTDu4woWzfp8WuH3tTrT3MC16GTmNzq";

  redditUserAgent= "desktop:flipflip:v2.0.0 (by /u/ififfy)";
  redditClientID = "2Iqe-1CsO4VQlA";
  redditRedirectURI = "http://localhost:65010";
  redditDeviceID = "";
  redditRefreshToken = "";
}

export class CacheSettings {
  enabled = true;
  directory = "";
  maxSize = 500; // Size in MB
}

export default class Config {
  defaultScene = new SceneSettings();
  remoteSettings = new RemoteSettings();
  caching = new CacheSettings();

  constructor(init?: Partial<Config>) {
    Object.assign(this, init);
  }
}

