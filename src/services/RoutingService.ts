/// <reference path="../../typings/typings.d.ts" />
import fs = require("fs");
import * as path from 'path';
import {Route} from '../models/Route';
import {ConfigService} from '../services/ConfigService';

export class RoutingService {

  private static _instance:RoutingService = new RoutingService();

  private _routes:Array<Route> = new Array();

  private _flatRoutes:Array<String> = new Array();

  private _languages:Array<string>;

  constructor() {
    if (RoutingService._instance) {
      throw new Error("Error: Instantiation failed: Use RoutingService.getInstance() instead of new.");
    }
    RoutingService._instance = this;
    this._init();
    console.log("RoutingService initialized");
  }

  public static getInstance():RoutingService {
    return RoutingService._instance;
  }

  get flatRoutes() {
    return this._flatRoutes;
  }


  private _init():void {
    const docs_root_folder = process.env.DOCS_SOURCE_FOLDER || '.';
    const lng = process.env.AVAILABLE_LANGUAGES || 'en';
    this._languages = lng.split(',');
    for (var language of this._languages) {
      this._initializeRoutes(docs_root_folder, language, ConfigService.getInstance().appConfig.displayVersion);
    }
  }

  get languages() {
    return this._languages;
  }

  public getRouteByUrl(url:string) {
    var u = url.split("/");
    u = u.filter(function (v) {
      return v !== ''
    });
    return this._findRoute(u, this._routes);
  }

  private _findRoute(u:Array<String>, routes:Array<Route>) {
    for (var j = 0; j < routes.length; j++) {
      if (routes[j].name === u[0]) {
        if (routes[j]._routes.length != 0) {
          u.shift();
          if (typeof u[0] == "undefined") {
            return routes[j];
          }
          var routes = routes[j]._routes;
          return this._findRoute(u, routes);
        } else {
          return routes[j];
        }
      }
    }
  }

  public getNext(url:string, language:string) {
    return this._findSibling(url, language, 1);
  }

  public getPrevious(url:string, language:string) {
    console.log(" Searching for previous for " + url);
    return this._findSibling(url, language, -1);
  }

  private _findSibling(url:string, language:string, direction:number) {
    var routeUrl:string = "/" + language + "/" + this._flatRoutes[this._flatRoutes.indexOf(url) + direction];
    console.log("searching route for " + routeUrl);
    if (typeof routeUrl !== "undefined") {

      return this.getRouteByUrl(routeUrl);
    }
    return null;
  }


  private flatten(routes:Array<Route>) {
    var flat = [];
    for (var i = 0; i < routes.length; i++) {
      if (routes[i]._routes.length != 0) {
        flat.push(routes[i].url);
        flat.push.apply(flat, this.flatten(routes[i]._routes));
      } else {
        flat.push(routes[i].url);
      }
    }
    return flat;
  }


  public getRoutesForLanguage(language:string) {
    for (var i = 0; i < this._routes.length; i++) {
      if (this._routes[i].language === language) {
        return this._routes[i];
      }
    }
  }

  private  _initializeRoutes(rootPath:string, language:string, version:string) {
    var path = rootPath + "/" + language;
    RoutingService._walkDir(path, path, null, version, language, (err, routes) => {
      if (!err) {
        this._routes.push(routes);
        //TODO add language specific flattening
        this._flatRoutes = this.flatten(this._routes);
      }
    });
  }

  private static skipDir(dir:string, limitVersion:string) {
    var configFile = path.resolve(dir, "config.yaml");
    if (fs.existsSync(configFile)) {
      var since = ConfigService.getDirConfig(configFile).since;
      if (Number(since) > Number(limitVersion)) {
        console.log("Skipping dir " + dir);
        return true;
      }
    }
    return false;
  }

  /**
   * Traverses directories and returns Route collection which are allowed for provided version
   * @param dir directory to scan
   * @param rootPath root path used as constant during traversing
   * @param version version stored into Route 0 if null provided
   * @param limitVersion version which should article match (be same or lower)
   * @param callback callback function
   * @private
   */
  private static _walkDir(dir:string, rootPath:string, version:string, limitVersion:string, language:string, callback:Function) {

    if (!RoutingService.skipDir(dir, limitVersion)) {
      fs.readdir(dir, function (err, list) {
        if (err) return callback(err);

        var since = '0';
        list.sort();
        var index = list.indexOf('_index.md');
        list.splice(index, 1);
        var file = dir + '/_index.md';
        var parentRoute = new Route(rootPath, file, since, language);
        var i = 0;
        (function next(parentRoute:Route) {
          var file = list[i++];
          if (!file) return callback(null, parentRoute);
          file = dir + '/' + file;
          fs.stat(file, function (err, stat) {
            if (stat && stat.isDirectory()) {
              RoutingService._walkDir(file, rootPath, since, limitVersion, language, function (err, res) {
                parentRoute.addChilds(res);
                next(parentRoute);
              });
            } else {
              var fName = file.substr(file.lastIndexOf("/") + 1);

              if (fName === 'config.yaml') {
                console.log('skipping CONFIG ' + file);
              } else {
                var fMatter = ConfigService.getFrontMatter(file);
                if (fMatter != null) {
                  if (Number(fMatter.since) > Number(limitVersion)) {
                    console.log("skipping file " + file);
                  } else {
                    var newRoute = new Route(rootPath, file, fMatter.since, language);
                    parentRoute.addChild(newRoute);
                  }
                } else {
                  var newRoute = new Route(rootPath, file, since, language);
                  parentRoute.addChild(newRoute);
                }
              }
              next(parentRoute);
            }
          });
        })(parentRoute);
      });
    } else {
      return callback(null, null);
    }
  }

}
