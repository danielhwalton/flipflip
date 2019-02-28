import {remote} from "electron";
import {URL} from "url";
import path from 'path';

import {ST} from "./const";
import en from "./en";
import Config from "./Config";
import * as fs from "fs";

export const saveDir = path.join(remote.app.getPath('appData'), 'flipflip');

export function getBackups() {
  const files = fs.readdirSync(saveDir);
  const backups = [];
  for (let file of files) {
    if (file.startsWith("data.json.")) {
      backups.push(file);
    }
  }
  backups.sort((a, b) => {
    if (a > b) {
      return -1;
    } else if (a < b) {
      return 1;
    } else {
      return 0;
    }
  });
  return backups;
}

export function getPath() {
  return path.join(remote.app.getPath('appData'), 'flipflip');
}

export function getFileName(url: string) {
  return url.substring(url.lastIndexOf("/"));
}

export function getFileGroup(url: string) {
  switch (getSourceType(url)) {
    case ST.tumblr:
      let tumblrID = url.replace(/https?:\/\//, "");
      tumblrID = tumblrID.replace(/\.tumblr\.com\/?/, "");
      return tumblrID;
    case ST.reddit:
      let redditID = url;
      if (url.endsWith("/")) redditID = redditID.slice(0, url.lastIndexOf("/"));
      redditID = redditID.substring(redditID.lastIndexOf("/") + 1);
      return redditID;
    case ST.local:
      return url.substring(url.lastIndexOf(path.sep)+1);
    case ST.list:
      break;
  }
}

export function getCachePath(source: string, config: Config) {
  if (config.caching.directory != "") {
    let baseDir = config.caching.directory;
    if (!baseDir.endsWith(path.sep)) {
      baseDir += path.sep;
    }
    if (source) {
      return baseDir + en.get(getSourceType(source)) + path.sep + getFileGroup(source) + path.sep;
    } else {
      return baseDir;
    }
  } else {
    if (source) {
      return getPath() + path.sep + "ImageCache" + path.sep + en.get(getSourceType(source)) + path.sep + getFileGroup(source) + path.sep;
    } else {
      return getPath() + path.sep + "ImageCache" + path.sep;
    }
  }
}

export function getSourceType(url: string): string {
  if (/^https?:\/\/([^.]*|(66\.media))\.tumblr\.com/.exec(url) != null) { // Tumblr
    return ST.tumblr;
  } else if (/^https?:\/\/www.reddit.com\//.exec(url) != null) {
    return ST.reddit;
  } else if (/^https?:\/\//.exec(url) != null) { // Arbitrary URL, assume image list
    return ST.list;
  } else { // Directory
    return ST.local;
  }
}

export function urlToPath(url: string): string {
  const path = new URL(url).pathname;
  if (process.platform === "win32") {
    return decodeURIComponent(path.substring(1, path.length));
  } else {
    return decodeURIComponent(path);
  }
}

export function removeDuplicatesBy(keyFn: Function, array: any[]): any[] {
  let mySet = new Set();
  return array.filter(function (x: any) {
    let key = keyFn(x);
    let isNew = !mySet.has(key);
    if (isNew) mySet.add(key);
    return isNew;
  });
}

export function arrayMove(arr: any[], old_index: number, new_index: number) {
  if (new_index >= arr.length) {
    let k = new_index - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
}

function getRandomIndex(list: any[]) {
  return Math.floor(Math.random() * list.length)
}

export function getRandomListItem(list: any[], count: number = 1) {
  if (count <= 0) {
    return;
  } else if (count == 1) {
    return list[getRandomIndex(list)];
  } else {
    let newList = [];
    for (let c = 0; c < count && list.length > 0; c++) {
      newList.push(list.splice(getRandomIndex(list), 1)[0])
    }
    return newList;
  }
}

// Inspired by https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html
// In order to assist with processing the next promise, this promise returns
// a list of strings as well as a value used to build the next promise. This vlaue is
// null if there is no follow-up promise.
export class CancelablePromise extends Promise<{data: Array<string>, next: any}> {
  hasCanceled: boolean;
  source: string;
  timeout: number;


  constructor(executor: (resolve: (value?: (PromiseLike<{data: Array<string>, next: any}> | {data: Array<string>, next: any})) => void, reject: (reason?: any) => void) => void) {
    super(executor);
    this.hasCanceled = false;
    this.source = "";
    this.timeout = 0;
  }

  getPromise(): Promise<{data: Array<string>, next: any}> {
    return new Promise((resolve, reject) => {
      this.then(
        val => this.hasCanceled ? null : resolve(val),
        error => this.hasCanceled ? null : reject(error)
      );
    });
  }

  cancel() {
    this.hasCanceled = true;
  }
}