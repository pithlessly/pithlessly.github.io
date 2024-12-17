"use strict";

// This file defines the core classes used in the game: players, asteroids,
// bullets, and particles. Note that there is only one class for particles;
// each different type of particle is defined by a seperate function.

// Represents the player.
function Player(canvWidth, canvHeight) {
    // The player's position.
    this.pos = new Pt(canvWidth / 2, canvHeight / 2);
    // The player's velocity.
    this.vel = new Pt(0, 0);
    // The direction the player is pointing in.
    this.dir = 0;
    // The player's angular momentum.
    this.dirDrift = 0;
    // How many frames the player is suspended for.
    this.deathFrames = 0;
}

// The multiplier applied to the player's velocity every frame.
Player.FRICTION = 0.98;
// The multiplier applied to the player's angular momentum every frame.
Player.ANGULAR_FRICTION = 0.7;

Player.outline = {
    // The coordinates of the player's outline.
    COORDINATES: [
        new Pt(0, 0),
        new Pt(1, -1),
        new Pt(0, 2),
        new Pt(-1, -1),
    ].map(pt => pt.scale(5)),
    // The width of the player's outline.
    WIDTH: 2,
    // The color of the player's outline: a light blue.
    COLOR: "#aaaaff",
};

// How many pixels forward the point from with bullets
// are fired is located in the outline.
Player.FIRE_POSITION = 12;
// How many pixels back the point from which exhaust
// is emitted is located in the outline.
Player.EXHAUST_POSITION = 5;
// How much the angular momentum is changed
// when the player turns for a frame.
Player.ANGULAR_ACCELERATION = TAU / 120;
// How much the velocity is changed when the player
// moves forward or backward for a frame.
Player.ACCELERATION = 0.4;

Player.drawPlayer = function(context, dir, centerPos) {
    context.strokeStyle = Player.outline.COLOR;
    context.beginPath();
    for (let pos of Player.outline.COORDINATES) {
        pos = pos.rotate(dir).add(centerPos);
        context.lineTo(pos.x, pos.y);
    }
    context.closePath();
    context.stroke();
};

// Return what the alpha of the player should be.
Player.prototype.getAlpha = function() {
    return this.isDead() && !flash(this.deathFrames, Math.sqrt(this.deathFrames))
         ? TRANSPARENT_ALPHA
         : OPAQUE_ALPHA;
};

Player.prototype.render = function(context, repel) {
    if (0 > this.deathFrames) {
        return;
    }
    context.globalAlpha = this.getAlpha();
    context.lineWidth = Player.outline.WIDTH;
    if (repel.isActive()) {
        context.strokeStyle = RepelObject.appearance.COLOR;
        context.beginPath();
        context.arc(this.pos.x, this.pos.y, 20, 0, TAU);
        context.stroke();
    }
    Player.drawPlayer(context, this.dir, this.pos);
    context.globalAlpha = 1;
};

Player.prototype.outside = function(pos, distance) {
    return (this.isDead() || this.pos.distance(pos) > distance);
};

Player.prototype.isDead = function() {
    return (this.deathFrames != 0);
};

Player.DEATH_FRAMES = 8 * FPS;

// The player has been hit by an asteroid.
Player.prototype.die = function(level, stopFrames) {
    level.lives--;
    stopFrames.pause();
    this.vel = new Pt(0, 0);
    if (level.lives > 0) {
        this.deathFrames = Player.DEATH_FRAMES;
    } else {
        // If there are no more lives left, die permanently.
        this.deathFrames = -1;
    }
}

Player.prototype.makeExplosion = function(particles) {
    for (let i = 0; i < 200; i++) {
        particles.push(explosionParticle.make(this.pos));
    }
};

// Update the player's state.
Player.prototype.update = function(canvWidth, canvHeight) {
    this.pos = this.pos.add(this.vel).wrap(canvWidth, canvHeight);
    this.vel = this.vel.scale(Player.FRICTION);
    this.dir += this.dirDrift;
    this.dirDrift *= Player.ANGULAR_FRICTION;
    if (this.deathFrames != 0) {
        this.deathFrames--;
    }
};

// Represents an asteroid.
function Asteroid(radius, pos, vel) {
    // The radius of the asteroid, used in hitboxes.
    this.radius = radius;
    // The asteroid's position.
    this.pos = pos;
    // The direction of the asteroid's motion.
    this.vel = vel;
    // The apparent rotation of the asteroid.
    this.angle = random.direction();
    // The apparent angular momentum of the asteroid.
    this.angleDrift = Asteroid.ANGULAR_MOMENTUM_VARIANCE * random.offset();
    // The list of distances between each of the asteroid's vertices
    // and its center, as a fraction of the radius.
    this.vertexDistances = Asteroid.genVertexDistances(Asteroid.VERTICES);
    // A unique symbol identifying the asteroid. This is used by the aimbot
    // to keep track of which asteroids are already being targeted.
    this.id = Symbol();
}

// The speed of an asteroid.
Asteroid.SPEED = 4;
// The maximum speed an asteroid can have.
Asteroid.MAX_SPEED = Asteroid.SPEED;

// The initial radius of asteroids.
Asteroid.INIT_SIZE = 30;
Asteroid.random = function() {
    return new this(this.INIT_SIZE, new Pt(0, 0), Pt.polar(this.SPEED, random.direction()));
};

// The range of possible angular momentums of an asteroid.
Asteroid.ANGULAR_MOMENTUM_VARIANCE = TAU / 20;
// The number of vertices an asteroid has.
Asteroid.VERTICES = 10;
// The closest an asteroid's vertex can be to its center, as a fraction of its radius.
Asteroid.MINIMUM_VERTEX_DISTANCE = 0.3;

// Return a random set of vertex distances for the asteroid.
Asteroid.genVertexDistances = function(n) {
    let result = [];
    for (let i = 0; i < n; i++) {
        result.push(random.between(Asteroid.MINIMUM_VERTEX_DISTANCE, 1));
    }
    return result;
}

Asteroid.OUTLINE_WIDTH = 2;
Asteroid.NORMAL_COLOR = [255, 255, 255];
Asteroid.REPEL_COLOR = [255, 165, 0];

Asteroid.prototype.render = function(context, color) {
    context.lineWidth = Asteroid.OUTLINE_WIDTH;
    context.strokeStyle = color;
    context.beginPath();
    for (let i = 0; i < this.vertexDistances.length; i++) {
        let angle = this.angle + (i / this.vertexDistances.length) * TAU;
        let pos = Pt.polar(this.vertexDistances[i] * this.radius, angle).add(this.pos);
        context.lineTo(pos.x, pos.y);
    }
    context.closePath();
    context.stroke();
}

// Return whether the asteroid includes a given point.
Asteroid.prototype.touches = function(p2) {
    return this.pos.distance(p2) < this.radius;
};

// Check whether the asteroid is touching the player, and, if so, kill it.
Asteroid.prototype.doPlayerCollision = function(player, particles, level, stopFrames, clearPowerups) {
    if (this.touches(player.pos)) {
        player.die(level, stopFrames);
        player.makeExplosion(particles);
        clearPowerups();
    }
};

Asteroid.size = {
    // The initial radius of an asteroid.
    INITIAL: 30,
    // The minimum radius of with which an asteroid can split.
    MINIMUM: 10,
    // How much smaller the asteroids it splits into are.
    SPLIT: 1.5,
    // How much the asteroid's mass is affected by its radius.
    DENSITY: 0.4,
};

// The maximum allowed difference between the weighted direction of the asteroid
// and the direction of one of the ones it splits into.
Asteroid.SPLIT_RANDOMNESS = TAU/6;

// Given that the asteroid has been struck by a bullet, return an array of new
// asteroids that this asteroid has split into.
Asteroid.prototype.split = function(level, bullet, scatter) {
    if (this.radius < Asteroid.size.MINIMUM) {
        // If the asteroid is too small to split further, we return no asteroids.
        level.score++;
        return [];
    } else if (scatter) {
        let numAsteroids = 1;
        let points = 0;
        let radius = this.radius;
        // Determine the number of asteroids to be split into.
        while (radius > Asteroid.size.MINIMUM) {
            points += numAsteroids;
            numAsteroids *= 2;
            radius /= Asteroid.size.SPLIT;
        }
        // Add the appropriate number of points.
        level.score += points;
        let result = [];
        for (let i = 0; i < numAsteroids; i++) {
            result.push(new Asteroid(radius, this.pos, Pt.polar(Asteroid.SPEED, random.direction())));
        }
        return result;
    } else {
        // Calculate the direction of the vector that is the sum of the asteroid's velocity
        // (weighted by its radius) and the bullet's velocity. The resulting two asteroids
        // will, on average, have that direction.
        let asteroidMass = this.radius * Asteroid.size;
        let newDir = this.vel.scaleTo(this.radius * Asteroid.size.DENSITY)
            .add(bullet.vel).direction();
        // We randomize the directions a little bit to make things interesting, though.
        let offset = Math.random() * Asteroid.SPLIT_RANDOMNESS;
        // Replace this with two new asteroids.
        level.score++;
        return [
            new Asteroid(
                this.radius / Asteroid.size.SPLIT,
                this.pos,
                Pt.polar(Asteroid.SPEED, newDir + offset)),
            new Asteroid(
                this.radius / Asteroid.size.SPLIT,
                this.pos,
                Pt.polar(Asteroid.SPEED, newDir - offset)),
        ];
    }
};

// Check whether the asteroid touches any of the bullets. If so, delete the bullet,
// increment the score, create a collision particle, and remove the asteroid from
// the list of targets. Return a new array of asteroids as a result (this will almost
// always contain only the original asteroid itself).
Asteroid.prototype.doBulletCollision = function(
    bullets,
    level,
    doCollisionFlash,
    stopFrames,
    scatter,
    particles,
    asteroidTargets
) {
    let self = this;
    let result = [this];
    let done = false;
    filterEach(bullets, function(bullet) {
        // If `result` has already been changed, we can skip all further iterations
        // of the loop.
        if (done) {
            return true;
        }
        if (self.touches(bullet.pos)) {
            // The asteroid is touching the bullet.
            result = self.split(level, bullet, scatter);
            particles.push(collisionParticle.make(bullet.pos));
            bullet.removeTarget(asteroidTargets);
            done = true;
            if (doCollisionFlash) {
                stopFrames.pause();
            }
            // Signal that the bullet should be deleted.
            return false;
        }
        // Signal that the bullet should not be deleted.
        return true;
    });
    return result;
};

// Perform collision with both the player and the bullets.
// Return a new array of asteroids as a result.
Asteroid.prototype.doCollision = function(
    player,
    bullets,
    level,
    doCollisionFlash,
    stopFrames,
    scatter,
    clearPowerups,
    particles,
    asteroidTargets
) {
    if (!player.isDead()) {
        this.doPlayerCollision(player, particles, level, stopFrames, clearPowerups);
    }
    return this.doBulletCollision(
        bullets,
        level,
        doCollisionFlash,
        stopFrames,
        scatter,
        particles,
        asteroidTargets
    );
};

// Update the asteroid's state. Return a new array of asteroids as a result.
Asteroid.prototype.update = function(
    canvWidth,
    canvHeight,
    player,
    bullets,
    level,
    doCollisionFlash,
    stopFrames,
    gameSpeed,
    scatter,
    repel,
    clearPowerups,
    particles,
    asteroidTargets
) {
    // Adjust the position according to the velocity.
    this.pos = this.pos.add(this.vel.scale(gameSpeed)).wrap(canvWidth, canvHeight);
    // Adjust the velocity to account for the repel effect.
    this.vel = this.vel.add(repel.guideAsteroid(player.pos, this.pos).scale(gameSpeed))
        .capMagnitude(Asteroid.MAX_SPEED);
    // Adjust the angle.
    this.angle += this.angleDrift * gameSpeed;
    return this.doCollision(
        player,
        bullets,
        level,
        doCollisionFlash,
        stopFrames,
        scatter,
        clearPowerups,
        particles,
        asteroidTargets
    );
};

// Represents a bullet fired by the player.
function Bullet(pos, vel, dir, target) {
    // The position of the bullet.
    this.pos = pos;
    // The velocity of the bullet.
    this.vel = vel;
    // The angle that the bullet points at.
    this.dir = dir;
    // The ID of the asteroid this bullet is targeting, or `null` if it's not targeting anything.
    this.target = target;
    // The number of subjective frames for which this bullet has been alive
    // (i.e. this number goes up more slowly when the game is slowed down).
    this.lifetime = 0;
}

// The maximum number of subjective frames for which a bullet can live.
Bullet.LIFETIME = 1.7 * FPS;
// The number of pixels a bullet moves per frame relative to the player
// when it is fired.
Bullet.SPEED = 5;
// The maximum number of pixels a bullet moves relative to the position from
// and velocity with which it was fired.
Bullet.MAX_DISTANCE = Bullet.LIFETIME * Bullet.SPEED;

// Return whether this bullet has a target.
Bullet.prototype.isGuided = function() {
    return (this.target != null);
};

// Remove from the list of targeted asteroids the target of this bullet, if it exists.
Bullet.prototype.removeTarget = function(asteroidTargets) {
    if (this.isGuided() && !asteroidTargets.delete(this.target)) {
        // The list of targeted asteroids should always include our target.
        throw "not listed as target";
    };
};

// Move the bullet. Return false if the bullet should be deleted.
Bullet.prototype.update = function(canvWidth, canvHeight, speed, asteroidTargets) {
    this.pos = this.pos.add(this.vel.scale(speed)).wrap(canvWidth, canvHeight);
    this.lifetime += speed;
    if (this.lifetime < Bullet.LIFETIME) {
        return true;
    } else {
        this.removeTarget(asteroidTargets);
        return false;
    }
};

Bullet.appearance = {
    // The bullet's color is the same as that of the player: a light blue.
    NORMAL_COLOR: Player.outline.COLOR,
    // The color that a guided asteroid flashes as.
    GUIDED_COLOR: "white",
    // The number of subjective frames it takes for a guided bullet to cycle between colors.
    FLASH_LENGTH: FPS / 3,
    // The bullet's length.
    LENGTH: 10,
    // The bullet's thickness.
    WIDTH: 3,
};

// Determine what color the bullet should have.
Bullet.prototype.getColor = function() {
    if (this.isGuided() && this.lifetime % Bullet.appearance.FLASH_LENGTH
            < Bullet.appearance.FLASH_LENGTH / 2) {
        return Bullet.appearance.GUIDED_COLOR;
    } else {
        return Bullet.appearance.NORMAL_COLOR;
    }
};

Bullet.prototype.render = function(context) {
	let endPoint = this.pos.subtract(Pt.polar(Bullet.appearance.LENGTH, this.dir));
	context.lineWidth = Bullet.appearance.WIDTH;
    context.strokeStyle = this.getColor();
    context.beginPath();
	context.moveTo(this.pos.x, this.pos.y);
	context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
};

function Particle(pos, vel, color, radius, shouldDie) {
    this.pos = pos;
    this.vel = vel;
    this.color = color;
    this.radius = radius;
    // A function that returns whether the particle should stay alive.
    this.shouldDie = shouldDie;
    // The number of subjective frames for which this particle has existed.
    this.age = 0;
}

// Update the particle. Return `false` if the particle should die.
Particle.prototype.update = function(gameSpeed, canvWidth, canvHeight) {
    this.age += gameSpeed;
    this.pos = this.pos.add(this.vel).wrap(canvWidth, canvHeight);
    return this.shouldDie();
};

Particle.prototype.render = function(context) {
    context.fillStyle = this.color;
    context.beginPath();
    context.arc(this.pos.x, this.pos.y, this.radius, 0, TAU);
    context.fill();
};

let exhaustParticle = {
    // The size of the arc that exhaust particles occupy.
    SPREAD: TAU / 10,
    // The number of exhaust particles produced per frame.
    RATE: 2,
    color: {
        // The colors used during normal play.
        NORMAL: ["red", "orange", "yellow"],
        // The colors used when time is stopped.
        FROZEN: ["#aaaaaa", "white", "#aaaaff"],
    },
    // The fraction of exhaust particles that should survive each frame.
    DECAY: 0.9,
    RADIUS: 2,
    make: function(pos, vel, timeStop) {
        let color = random.choice(
            timeStop.isActive()
          ? this.color.FROZEN
          : this.color.NORMAL);
        let decay = this.DECAY;
        return new Particle(pos, vel, color, this.RADIUS, function() {
            return Math.random() < decay;
        });
    },
};

let collisionParticle = {
    // The number of subjective frames for which this particle should exist.
    LIFESPAN: 8,
    // The same color as bullets.
    COLOR: Bullet.appearance.NORMAL_COLOR,
    RADIUS: 4,
    make: function(pos) {
        let lifespan = this.LIFESPAN;
        return new Particle(pos, new Pt(0, 0), this.COLOR, this.RADIUS, function() {
            return (this.age < lifespan);
        });
    },
};

let explosionParticle = {
    DECAY: 0.94,
    COLOR: exhaustParticle.color.NORMAL.concat([Player.outline.COLOR]),
    RADIUS: 3,
    make: function(pos) {
        let color = random.choice(this.COLOR);
        let decay = this.DECAY;
        let vel = Pt.polar(random.between(0, 5), random.direction());
        return new Particle(pos, vel, color, this.RADIUS, function() {
            this.vel = this.vel.scale(0.97);
            return this.age < 10 || Math.random() < decay;
        });
    },
};
