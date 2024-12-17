"use strict";

// This is my take on the classic arcade game "Asteroids." The core gameplay is
// the same as that of the original game, but it also includes new features,
// such as a variety of powerups, asteroids with randomly generated shapes, and
// more interesting visual effects.

// This code was written entirely from scratch, but there were a few things for
// which I consulted the internet:

// - The creation of the function `aimAtMovingTarget` was assisted by user
//   7Geordi's comment on the r/gamedev subreddit:
//   https://www.reddit.com/r/gamedev/comments/16ceki/turret_aiming_formula/c7vbu2j/
// - The code used in `MouseTracker` to get the mouse position was written with
//   help from a StackOverflow answer by user Martin Wantke:
//   https://stackoverflow.com/a/48500289

// This file contains definitions for various utility functions and constants
// that are used in the rest of the code. They are largely independent of the
// actual game.

const FPS = 60;
// We use tau instead of pi for convenience reasons.
const TAU = 2 * Math.PI;

// Return an array of integers from 0 to n-1.
function range(n) {
    return Array.from(Array(n).keys());
}

// A module containing various
let random = {
    // Return a random element from an array.
    choice: function(array) {
        return array[Math.floor(Math.random() * array.length)];
    },
    // Return a random direction.
    direction: function() {
        return Math.random() * TAU;
    },
    // Return a random number between -0.5 and 0.5.
    offset: function() {
        return Math.random() - 0.5;
    },
    // Return a random number between `a` and `b`.
    between: function(a, b) {
        return a + Math.random() * (b - a);
    },
};

// Return an array of real solutions to the quadratic equation given by
// ax^2 + bx + c == 0.
function solveQuadratic(a, b, c) {
    let temp = b*b - 4*a*c;
    if (temp < 0) {
        return [];
    }
    else if (temp == 0) {
        return [-b / 2*a];
    }
    else {
        temp = Math.sqrt(temp);
        return [(-b+temp) / (2*a),
                (-b-temp) / (2*a)];
    }
};

// Iterate through an array and call a function on each element.
// If that function returns false, delete the element from the array.
function filterEach(array, f) {
    for (let i = 0; i < array.length; i++) {
        if (!f(array[i])) {
            array.splice(i, 1);
            i--;
        }
    }
}

// Iterate through an array and call a function on each element.
// Replace the element with the array returned by the function.
function flatMapEach(array, f) {
    let i = 0;
    while (i < array.length) {
        let results = f(array[i]);
        array.splice(i, 1, ...results);
        i += results.length;
    }
}

// Interpolate between two values: return a number `t` of the way
// between `a` and `b`.
function interpolate(a, b, t) {
    return a*(1-t) + b*t;
}

// Interpolate between two lists by interpolating between corresponding values.
function interpolateList(as, bs, t) {
    let result = [];
    for (let i = 0; i < Math.min(as.length, bs.length); i++) {
        result.push(interpolate(as[i], bs[i], t));
    }
    return result;
}

function flash(n, cycleLength) {
    return (n % cycleLength > cycleLength / 2);
}

// Act like Python's modulo.
function modulo(n, d) {
    return ((n % d) + d) % d;
}

// Return the distance between two points in modular arithmetic.
function modularDistance(a, b, modulus) {
    let dist = modulo(a - b, modulus);
    return Math.min(dist, modulus - dist);
}

// A two-dimensional vector of floating-point numbers.
function Pt(x, y) {
    this.x = x;
    this.y = y;
    if (isNaN(x) || isNaN(y)) {
        throw "invalid point";
    }
}

// Construct a vector from a direction and magnitude.
Pt.polar = function(r, theta) {
    return new Pt(r * -Math.sin(theta), r * Math.cos(theta));
};

// Return the vector's direction.
Pt.prototype.direction = function() {
	return -Math.atan2(this.x, this.y);
};

// Return the square of the vector's magnitude.
Pt.prototype.magnitude2 = function() {
    let {x, y} = this;
    return x*x + y*y;
};

// Return the vector's magnitude.
Pt.prototype.magnitude = function() {
    return Math.sqrt(this.magnitude2());
};

// Scale a vector by some factor.
Pt.prototype.scale = function(factor) {
    return new Pt(this.x * factor, this.y * factor);
};

// Add two vectors.
Pt.prototype.add = function(p2) {
    return new Pt(this.x + p2.x, this.y + p2.y);
};

// Subtract two vectors.
Pt.prototype.subtract = function(p2) {
    return new Pt(this.x - p2.x, this.y - p2.y);
};

// Take the dot product of two vectors.
Pt.prototype.dot = function(p2) {
    return (this.x * p2.x) + (this.y * p2.y);
};

// Find the distance between two vectors.
Pt.prototype.distance = function(p2) {
    return this.subtract(p2).magnitude();
};

// Wrap a vector around a certain height and width.
Pt.prototype.wrap = function(xd, yd) {
    return new Pt(modulo(this.x, xd), modulo(this.y, yd));
};

// Return a new vector that has the same direction and length `n`.
Pt.prototype.scaleTo = function(n) {
   return this.scale(n / this.magnitude());
};

Pt.prototype.capMagnitude = function(m) {
    if (this.magnitude() > m) {
        return this.scaleTo(m);
    } else {
        return this;
    }
};

// Rotate the vector a number of radians around the origin.
Pt.prototype.rotate = function(direction) {
    let x = this.x;
    let y = this.y;
    let cos = Math.cos(direction);
    let sin = Math.sin(direction);
    return new Pt(x*cos - y*sin, y*cos + x*sin);
};

// Given the position and velocity of a target, return an array of possible angles to fire at such
// that a bullet fired with a given speed from the origin at that angle will collide with it.
// Assume bullets can travel no farther than `maxDistance`.
function aimAtMovingTarget(targetPos, targetVel, bulletSpeed, maxDistance) {
    // The array of possible moments at which contact could be made.
    let times = solveQuadratic(
        targetVel.magnitude2() - bulletSpeed * bulletSpeed,
        2 * targetPos.dot(targetVel),
        targetPos.magnitude2()
    ).filter(time => time > 0);
    // The array of possible positions at which contact could be made.
    let positions = times.map(time => targetVel.scale(time).add(targetPos))
        .filter(pos => pos.magnitude() < maxDistance);
    // The array of angles to fire from to contact such a point.
    let angles = positions.map(position => position.direction());
    return angles;
}

// Wraps an `eventListener` that keeps track of keydown events.
function KeyTracker() {
    // There are three different key states:
    // - A key state of 2 means that the key is pressed, but this has not been checked yet.
    // - A key state of 1 means that the key is pressed, and this has already been checked.
    // - A key state of 0 means that the key is up.
    this.keyStates = {};
    let self = this;
    window.addEventListener("keydown", function(e) {
        if (e.key == " " || e.key.startsWith("Arrow")) {
            e.preventDefault();
        }
        if (self.keyStates[e.key] != 1) {
            self.keyStates[e.key] = 2;
        }
    });
    window.addEventListener("keyup", e => self.keyStates[e.key] = 0);
}

// Check the state of a key. If it is 2, update it accordingly.
KeyTracker.prototype.getKeyState = function(key) {
    let keyState = this.keyStates[key];
    if (keyState == undefined) {
        keyState = 0;
    }
    if (keyState == 2) {
        this.keyStates[key] = 1;
    }
    return keyState;
};

// Check whether a key is down.
KeyTracker.prototype.down = function(key) {
    return (this.getKeyState(key) > 0);
};

// Check that a key is down and that this is the first time this has been checked.
KeyTracker.prototype.newDown = function(key) {
    return (this.getKeyState(key) == 2);
};

// Wraps an `eventListener` that keeps track of the mouse position.
function MouseTracker(canvas) {
    var rect = canvas.getBoundingClientRect();
    this.pos = new Pt(0, 0);
    let self = this;
    canvas.addEventListener("mousemove", function(evt) {
        self.pos = new Pt(
            evt.clientX - rect.left - canvas.clientLeft,
            evt.clientY - rect.top - canvas.clientTop,
        );
    });
};

// The alpha with which to draw transparent things.
const TRANSPARENT_ALPHA = 0.3;
// The alpha with which to draw opaque things.
const OPAQUE_ALPHA = 1;
