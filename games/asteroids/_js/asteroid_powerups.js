"use strict";

// This file defines the six powerups present in the game:

// - timeStop, which slows down time;
// - aimbot, which will cause the player to shoot at precisely the right angle
//   to hit an asteroid;
// - scatter, which causes larger asteroids to immediately be split into tiny
//   ones;
// - tripleBullet, which causes the player to fire three bullets at a time;
// - repel, which causes the player to repel nearby asteroids;
// - life, which gives the player an extra life.

// Every powerup has two classes associated with it:

// - An "object class" that implements the actual collectible object;
// - An "effect class" that governs the behavior of the powerup.

// The exception to this is the life powerup, which has no effect class because
// it has no prolonged effect associated with it.

// The visual radius of all powerup objects.
const POWERUP_VISUAL_RADIUS = 10;
// The physical radius of powerup objects.
const POWERUP_PHYSICAL_RADIUS = 2 * POWERUP_VISUAL_RADIUS;
// The distance (in pixels) that a powerup moves per subjective frame.
const POWERUP_SPEED = 4;
// The angle by which a powerup rotates every frame. Note that some powerups
// don't use this.
const POWERUP_ANGULAR_MOMENTUM = TAU/90;

// Represents a collectible powerup that can stop time.
// It appears as a circular clock with hour and minute hands.
function TimeStopObject(pos, dir) {
    // The position of this object.
    this.pos = pos;
    // The direction in which the object is moving.
    this.dir = dir;
    // The rotation of the hour hand.
    this.hourHandRotation = random.direction();
    // The rotation of the minunte hand.
    this.minuteHandRotation = random.direction();
}

// The amount by which the hour hand moves every subjective frame.
TimeStopObject.HOUR_HAND_SPEED = TAU / 60;
// The amount by which the minute hand moves every subjective frame.
TimeStopObject.MINUTE_HAND_SPEED = TAU / 30;

// Move the object.
TimeStopObject.prototype.move = function(gameSpeed, canvWidth, canvHeight) {
    let vel = Pt.polar(POWERUP_SPEED * gameSpeed, this.dir);
    this.pos = this.pos.add(vel).wrap(canvWidth, canvHeight);
}

// Move the object and change the rotation of its hour and minute hands.
// If it is touching the player, activate `timeStop` and return `false`.
TimeStopObject.prototype.update = function(game) {
    let gameSpeed = game.timeStop.speed();
    this.move(gameSpeed, game.canvWidth, game.canvHeight);
    this.hourHandRotation += TimeStopObject.HOUR_HAND_SPEED * gameSpeed;
    this.minuteHandRotation += TimeStopObject.MINUTE_HAND_SPEED * gameSpeed;
    if (game.player.outside(this.pos, POWERUP_PHYSICAL_RADIUS)) {
        return true;
    } else {
        game.timeStop.activate();
        return false;
    }
};

TimeStopObject.appearance = {
    // A very light blue.
    COLOR: "#ddddff",
    // The thickness of the object's outline and hands.
    WIDTH: 2,
    // The length of the hour hand.
    HOUR_HAND_LENGTH: POWERUP_VISUAL_RADIUS * 0.5,
    // The length of the minute hand.
    MINUTE_HAND_LENGTH: POWERUP_VISUAL_RADIUS * 0.7,
};

// Render one hand of the clock to the screen.
TimeStopObject.prototype.drawHand = function(context, length, rotation) {
    let tip = Pt.polar(length, rotation).add(this.pos);
    context.moveTo(this.pos.x, this.pos.y);
    context.lineTo(tip.x, tip.y);
};

TimeStopObject.prototype.render = function(context) {
    context.strokeStyle = TimeStopObject.appearance.COLOR;
    context.lineWidth = TimeStopObject.appearance.WIDTH;
    context.beginPath();
    context.arc(this.pos.x, this.pos.y, POWERUP_VISUAL_RADIUS, 0, TAU);
    this.drawHand(
        context,
        TimeStopObject.appearance.HOUR_HAND_LENGTH,
        this.hourHandRotation);
    this.drawHand(
        context,
        TimeStopObject.appearance.MINUTE_HAND_LENGTH,
        this.minuteHandRotation);
    context.stroke();
};

// Controls the speed at which all objects (other than the player) move.
function TimeStopEffect() {
    this.clear();
}

// Reset the effect.
TimeStopEffect.prototype.clear = function() {
    // What the speed was when the transition started.
    this.start = TimeStopEffect.INACTIVE;
    // What the speed will be when the transition ends.
    this.target = TimeStopEffect.INACTIVE;
    // How far we are in the transition (between 0 and 1).
    this.t = 0;
    // How many frames to delay updating the transition.
    this.stopFrames = 0;
};

// Get the current game speed.
TimeStopEffect.prototype.speed = function() {
    return interpolate(this.start, this.target, this.t);
};

// The speed when the effect is inactive.
TimeStopEffect.INACTIVE = 1;
// The game speed below which this effect is considered active.
TimeStopEffect.ACTIVE_THRESHOLD = 0.8 * TimeStopEffect.INACTIVE;

// Decide whether this is active.
TimeStopEffect.prototype.isActive = function() {
    return this.speed() < TimeStopEffect.ACTIVE_THRESHOLD;
};

// Begin the transition to a different target.
TimeStopEffect.prototype.changeTarget = function(target) {
    this.start = this.speed();
    this.target = target;
    this.t = 0;
};

// The minimum game speed reached with the time stop powerup.
TimeStopEffect.MIN_SPEED = 0.1;

// Active the time stop powerup.
TimeStopEffect.prototype.activate = function() {
    this.changeTarget(TimeStopEffect.MIN_SPEED);
};

// The amount by which to change `this.t` every frame.
TimeStopEffect.TRANSITION_SPEED = 0.02;
// How many frames to pause at the minimum speed when the powerup is active.
TimeStopEffect.PAUSE_LENGTH = 5 * FPS;

// Proceed through the transition and add stop frames when it is complete.
TimeStopEffect.prototype.update = function() {
    if (this.stopFrames > 0) {
        this.stopFrames--;
        return;
    }
    if (this.t < 1) {
        this.t += TimeStopEffect.TRANSITION_SPEED;
    } else {
        if (this.target != TimeStopEffect.INACTIVE) {
            this.changeTarget(TimeStopEffect.INACTIVE);
            this.stopFrames = TimeStopEffect.PAUSE_LENGTH;
        }
    }
};

// Represents a collectible powerup that allows the player to
// automatically aim perfectly at asteroids.
// It appears as a red circle with a crosshair in the center.
function AimbotObject(pos, dir) {
    this.pos = pos;
    this.dir = dir;
    this.rotation = random.direction();
}

// Move the object.
AimbotObject.prototype.move = function(gameSpeed, canvWidth, canvHeight) {
    let vel = Pt.polar(POWERUP_SPEED * gameSpeed, this.dir);
    this.pos = this.pos.add(vel).wrap(canvWidth, canvHeight)
}

// Move and rotate the object. If it is touching the player, activate the
// aimbot and return `false`.
AimbotObject.prototype.update = function(game) {
    this.move(game.timeStop.speed(), game.canvWidth, game.canvHeight);
    this.rotation += POWERUP_ANGULAR_MOMENTUM * game.timeStop.speed();
    if (game.player.outside(this.pos, POWERUP_PHYSICAL_RADIUS)) {
        return true;
    } else {
        game.aimbot.activate();
        return false;
    }
};

AimbotObject.appearance = {
    // Light red.
    COLOR: "#ff8888",
    // The width of the powerup's outline.
    WIDTH: 2,
}

function drawPlus(context, pos, rotation, radius) {
    // Draw a line normally and at a right angle.
    for (let rot of [0, TAU/4]) {
        let r = Pt.polar(radius, rotation + rot);
        let startPoint = pos.add(r);
        let endPoint   = pos.subtract(r);
        context.moveTo(startPoint.x, startPoint.y);
        context.lineTo(endPoint.x, endPoint.y);
    }
}

AimbotObject.prototype.render = function(context) {
    context.strokeStyle = AimbotObject.appearance.COLOR;
    context.lineWidth = AimbotObject.appearance.WIDTH;
    context.beginPath();
    context.arc(this.pos.x, this.pos.y, POWERUP_VISUAL_RADIUS, 0, TAU);
    drawPlus(context, this.pos, this.rotation, POWERUP_VISUAL_RADIUS);
    context.stroke();
}

// Controls the aimbot.
function AimbotEffect() {
    this.clear();
}

// Reset the effect.
AimbotEffect.prototype.clear = function() {
    this.time = 0;
};

// The number of subjective frames for which the effect persists.
AimbotEffect.LENGTH = 10 * FPS;

// Enable the aimbot.
AimbotEffect.prototype.activate = function() {
    this.time = AimbotEffect.LENGTH;
};

// Update the aimbot effect.
AimbotEffect.prototype.update = function() {
    if (this.time > 0) {
        this.time--;
    }
};

// Whether the aimbot is enabled permanently.
AimbotEffect.permanent = false;

// Given the position from which a bullet is fired, return an array of two elements:
// - The asteroid that is targeted, if any (only if the aimbot is active)
// - The angle at which the bullet should be fired.
AimbotEffect.prototype.guide = function(game, firePos, dir) {
    let bulletVel = Pt.polar(Bullet.SPEED, dir);
    // If the aimbot is inactive, simply return the original velocity.
    if (!this.time && !AimbotEffect.permanent) {
        return [null, bulletVel.add(game.player.vel)];
    }
    // Choose an asteroid such that the angle necessary to fire at it is as close as
    // possible to the angle the player would otherwise fire at.
    let targetAsteroid = null;
    let closestTargetAngle = null;
    let closestTargetAngleMargin = null;
    for (let asteroid of game.asteroids) {
        // If the asteroid is already being targeted by another bullet, ignore it.
        if (game.asteroidTargets.has(asteroid.id)) {
            continue;
        }
        // The position and veocity of the asteroid, relative to where the bullet is fired.
        let relativePos = asteroid.pos.subtract(firePos);
        let relativeVel =  asteroid.vel.subtract(game.player.vel);
        let targetAngles = aimAtMovingTarget(
            relativePos,
            relativeVel,
            Bullet.SPEED,
            Bullet.MAX_DISTANCE,
        );
        for (let targetAngle of targetAngles) {
            let margin = modularDistance(targetAngle, dir, TAU);
            if (!closestTargetAngleMargin || margin < closestTargetAngleMargin) {
                closestTargetAngleMargin = margin;
                closestTargetAngle = targetAngle;
                targetAsteroid = asteroid.id;
            }
        }
    }
    // If no angle is satisfactorily close, just fire in the original direction.
    if (closestTargetAngle == null || closestTargetAngleMargin > TAU/10) {
        return [null, bulletVel.add(game.player.vel)];
    } else {
        return [targetAsteroid, Pt.polar(Bullet.SPEED, closestTargetAngle).add(game.player.vel)];
    }
};

// Represents a collectible powerup that causes destroyed asteroids to split
// into the smallest possible parts.
// Appears as a circle containing eight dots.
function ScatterObject(pos, dir) {
    this.pos = pos;
    this.dir = dir;
    this.rotation = random.direction();
}

// Update the object.
ScatterObject.prototype.update = function(game) {
    let gameSpeed = game.timeStop.speed();
    this.rotation += POWERUP_ANGULAR_MOMENTUM * gameSpeed;
    let vel = Pt.polar(POWERUP_SPEED * gameSpeed, this.dir);
    this.pos = this.pos.add(vel).wrap(game.canvWidth, game.canvHeight);
    if (game.player.outside(this.pos, POWERUP_PHYSICAL_RADIUS)) {
        return true;
    } else {
        game.scatter.activate();
        return false;
    }
};

ScatterObject.appearance = {
    COLOR: "yellow",
    // The width of the powerup's outline.
    WIDTH: 2,
    // The number of dots.
    NUM_DOTS: 8,
    // The radius of the dots.
    DOT_RADIUS: 1.5,
    // The distance between the dots and the center of the powerup.
    DOT_DISTANCE: 0.5 * POWERUP_VISUAL_RADIUS,
};

ScatterObject.prototype.render = function(context) {
    let app = ScatterObject.appearance;
    context.strokeStyle = app.COLOR;
    context.fillStyle = app.COLOR;
    context.lineWidth = app.WIDTH;
    context.beginPath();
    context.arc(this.pos.x, this.pos.y, POWERUP_VISUAL_RADIUS, 0, TAU);
    context.stroke();
    // Draw a ring of dots in a circle.
    for (let offset of range(app.NUM_DOTS)) {
        let angle = offset * TAU/app.NUM_DOTS + this.rotation;
        let pos = this.pos.add(Pt.polar(app.DOT_DISTANCE, angle));
        context.beginPath();
        context.arc(pos.x, pos.y, app.DOT_RADIUS, 0, TAU);
        context.fill();
    }
};

// Controls the scatter effect.
function ScatterEffect() {
    this.clear();
}

// Reset the effect.
ScatterEffect.prototype.clear = function() {
    this.time = 0;
};

// Return whether the effect is currently active.
ScatterEffect.prototype.isActive = function() {
    return (this.time > 0);
};

// Update the effect.
ScatterEffect.prototype.update = function() {
    if (this.isActive()) {
        this.time--;
    }
};

// The number of frames for which the effect lasts.
ScatterEffect.DURATION = 10 * FPS;

// Activate the effect.
ScatterEffect.prototype.activate = function() {
    this.time = ScatterEffect.DURATION;
};

// Represents a collectible powerup that causes the player to fire three
// bullets at a time.
// Appears as a dark green circle with three parallel lines in the center.
function TripleBulletObject(pos, dir) {
    this.pos = pos;
    this.dir = dir;
    this.rotation = random.direction();
}

TripleBulletObject.appearance = {
    // A dark green.
    COLOR: "#88aa44",
    // The width of the outline.
    WIDTH: 2,
    // The length of each of the inner segments.
    LINE_LENGTH: 0.7 * POWERUP_VISUAL_RADIUS,
    // The distance between each of the inner segments.
    LINE_SPACING: 0.45 * POWERUP_VISUAL_RADIUS,
};

// Update the object.
TripleBulletObject.prototype.update = function(game) {
    let gameSpeed = game.timeStop.speed();
    this.rotation += POWERUP_ANGULAR_MOMENTUM * gameSpeed;
    let vel = Pt.polar(POWERUP_SPEED * gameSpeed, this.dir);
    this.pos = this.pos.add(vel).wrap(game.canvWidth, game.canvHeight);
    if (game.player.outside(this.pos, POWERUP_PHYSICAL_RADIUS)) {
        return true;
    } else {
        game.tripleBullet.activate();
        return false;
    }
};

TripleBulletObject.prototype.render = function(context) {
    let app = TripleBulletObject.appearance;
    context.strokeStyle = app.COLOR;
    context.beginPath();
    context.arc(this.pos.x, this.pos.y, POWERUP_VISUAL_RADIUS, 0, TAU);
    context.stroke();
    let spacing = TripleBulletObject.appearance.LINE_SPACING;
    for (let lineX of [-spacing, 0, spacing]) {
        context.beginPath();
        let centerPos = Pt.polar(lineX, this.rotation).add(this.pos);
        let tipOffset = Pt.polar(
            TripleBulletObject.appearance.LINE_LENGTH / 2,
            this.rotation + TAU/4);
        let startPos = centerPos.add(tipOffset);
        let endPos = centerPos.subtract(tipOffset);
        context.moveTo(startPos.x, startPos.y);
        context.lineTo(endPos.x, endPos.y);
        context.stroke();
    }
};

// Controls the triple bullet effect.
function TripleBulletEffect() {
    this.clear();
}

// Reset the effect.
TripleBulletEffect.prototype.clear = function() {
    this.time = 0;
};

// Return whether the effect is currently active.
TripleBulletEffect.prototype.isActive = function() {
    return (this.time > 0);
};

// Update the effect.
TripleBulletEffect.prototype.update = function() {
    if (this.isActive()) {
        this.time--;
    }
};

// The number of subjective frames for which the effect lasts.
TripleBulletEffect.DURATION = 8 * FPS;

// Activate the effect.
TripleBulletEffect.prototype.activate = function() {
    this.time = TripleBulletEffect.DURATION;
};

// The difference in angle between the three bullets.
TripleBulletEffect.SPREAD = TAU/24;

// Return the list of angles at which to produce bullets, relative to the
// angle of the player.
TripleBulletEffect.prototype.angles = function() {
    if (this.isActive()) {
        let spread = TripleBulletEffect.SPREAD;
        return [-spread, 0, spread];
    } else {
        return [0];
    }
};

// Represents a collectible powerup that causes the player to repel asteroids.
// It appears as an orange circle with a smaller circle in the center.
function RepelObject(pos, dir) {
    this.pos = pos;
    this.dir = dir;
    this.rotation = random.direction();
};

RepelObject.appearance = {
    // A bright orange.
    COLOR: `rgb(${Asteroid.REPEL_COLOR})`,
    // The width of the outline.
    WIDTH: 2,
    // The radius of the inner circle.
    INNER_RADIUS: 0.5 * POWERUP_VISUAL_RADIUS,
};

// Update the object.
RepelObject.prototype.update = function(game) {
    let gameSpeed = game.timeStop.speed();
    this.rotation += POWERUP_ANGULAR_MOMENTUM * gameSpeed;
    let vel = Pt.polar(POWERUP_SPEED * gameSpeed, this.dir);
    this.pos = this.pos.add(vel).wrap(game.canvWidth, game.canvHeight);
    if (game.player.outside(this.pos, POWERUP_PHYSICAL_RADIUS)) {
        return true;
    } else {
        game.repel.activate();
        return false;
    }
};

RepelObject.prototype.render = function(context) {
    let app = RepelObject.appearance;
    context.strokeStyle = app.COLOR;
    context.lineWidth = app.WIDTH;
    // Draw circles of two different radii.
    for (let radius of [POWERUP_VISUAL_RADIUS, app.INNER_RADIUS]) {
        context.beginPath();
        context.arc(this.pos.x, this.pos.y, radius, 0, TAU);
        context.stroke();
    }
};

// Controls the repel effect.
function RepelEffect() {
    this.clear();
}

// Reset the effect.
RepelEffect.prototype.clear = function() {
    this.time = 0;
};

// Return whether the effect is active.
RepelEffect.prototype.isActive = function() {
    return (this.time > 0);
};

// Update the effect.
RepelEffect.prototype.update = function() {
    if (this.isActive()) {
        this.time--;
    }
};

// The number of frames for which the effect should last.
RepelEffect.DURATION = 20 * FPS;

// Activate the effect.
RepelEffect.prototype.activate = function() {
    this.time = RepelEffect.DURATION;
};

// A multiplier for the effect's repulsive force.
RepelEffect.SCALE = 100000;

// Return the acceleration on an asteroid due to the effect.
RepelEffect.prototype.guideAsteroid = function(playerPos, asteroidPos) {
    if (!this.isActive()) {
        return new Pt(0, 0);
    }
    let diff = asteroidPos.subtract(playerPos);
    return diff.scaleTo(RepelEffect.SCALE / diff.magnitude() ** 3);
};

// Return the color of an asteroid due to the effect.
RepelEffect.prototype.colorAsteroid = function(playerPos, asteroidPos) {
    let color;
    if (this.isActive()) {        
        let t = Math.min(1, playerPos.distance(asteroidPos) / 100);
        color = interpolateList(Asteroid.REPEL_COLOR, Asteroid.NORMAL_COLOR, t);
    } else {
        color = Asteroid.NORMAL_COLOR;
    }
    return `rgb(${color})`;
};

// Represents a powerup that gives the player an extra life.
// The player can have a maximum of five lives; this powerup will not appear if
// it would allow the player to obtain more.
// It appears as a green circle with a plus in the center.
function LifeObject(pos, dir) {
    this.pos = pos;
    this.dir = dir;
    this.rotation = random.direction();
}

// Update the object.
LifeObject.prototype.update = function(game) {
    let gameSpeed = game.timeStop.speed();
    this.rotation += POWERUP_ANGULAR_MOMENTUM * gameSpeed;
    let vel = Pt.polar(POWERUP_SPEED * gameSpeed, this.dir);
    this.pos = this.pos.add(vel).wrap(game.canvWidth, game.canvHeight);
    if (game.player.outside(this.pos, POWERUP_PHYSICAL_RADIUS)) {
        return true;
    } else {
        game.level.lifePowerups--;
        game.level.lives++;
        return false;
    }
};

LifeObject.appearance = {
    // Light green.
    BORDER_COLOR: "#00ff00",
    // The width of the border, in pixels.
    WIDTH: 2,
};


LifeObject.prototype.render = function(context) {
    let app = LifeObject.appearance;
    context.strokeStyle = app.BORDER_COLOR;
    context.lineWidth = app.WIDTH;
    context.beginPath();
    context.arc(this.pos.x, this.pos.y, POWERUP_VISUAL_RADIUS, 0, TAU);
    drawPlus(context, this.pos, this.rotation, 0.6 * POWERUP_VISUAL_RADIUS);
    context.stroke();
};

// The list of powerups.
const ALL_POWERUPS = [
    TimeStopObject,
    AimbotObject,
    ScatterObject,
    TripleBulletObject,
    RepelObject,
    LifeObject,
];