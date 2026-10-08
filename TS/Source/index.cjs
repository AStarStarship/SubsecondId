// Copyright AStarship <https://astarship.net>.

const { SubsecondIdNextShared, SubsecondIdNextHexShared } = require('../dist');
const { randomInt } = require('crypto');

export function SubsecondIdNext() {
  return SubsecondIdNextShared(randomInt);
}

export function SubsecondIdNextHex() {
  return SubsecondIdNextHexShared(randomInt);
}
