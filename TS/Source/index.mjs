// Copyright AStarship <https://astarship.net>.

import { SubsecondIdNextShared, SubsecondIdNextHexShared } from '../dist';
import { randomInt } from 'crypto';

export function SubsecondIdNext() {
  return SubsecondIdNextShared(randomInt);
}

export function SubsecondIdNextHex() {
  return SubsecondIdNextHexShared(randomInt);
}
