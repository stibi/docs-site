import { SemVer } from 'semver';

module VersionUtils {

  'use strict';

  /**
   * Converts loose version to SemVer format. this function is basically just helper because user may not enter
   * version in completely valid SemVer format (see. http://semver.org)
   *
   * 1 => 1.0.0
   * 1.1 => 1.1.0
   * 10.20-rc1 => 10.20.0-rc1
   *
   */
  export function toSemver(version: string): SemVer {
    // rhttps://regex101.com/r/cQ5hQ9/1
    let re = /^(\d+(\.\d+)?)(?!\.\d+)(.*)$/;
    let m = re.exec(version);
    if (m !== null) {
      if (typeof m[2] === 'undefined') {
        return new SemVer(m[1] + ".0.0" + m[3]);
      }
      return new SemVer(m[1] + ".0" + m[3]);
    } else {
      return new SemVer(version);
    }
  }
}
export = VersionUtils;
