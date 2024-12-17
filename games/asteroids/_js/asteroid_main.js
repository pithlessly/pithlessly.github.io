"use strict";

// This defines the main funcionality of the game.

// Keeps track of level and score information.
function Level() {
    this.score = 0;
    // We technically start on level 0, but this is
    // immediately updated after the first frame.
    this.level = 0;
    // How many remaining lives the player has.
    this.lives = 3;
    // How many powerups are in the game.
    this.powerups = 0;
    // How many of those powerups are life powerups.
    this.lifePowerups = 0;
    // How many powerups have appeared this level.
    this.levelPowerups = 0;
    // Whether the player has cheated.
    this.cheated = false;
}

// The maximum number of powerups in the game.
Level.MAX_POWERUPS = 3;
// The maximum number of powerups allowed per level.
Level.MAX_POWERUPS_PER_LEVEL = 6;
// The maximum number of lives the player can attain.
Level.MAX_LIVES = 5;

// If all the asteroids have vanished, update the level and spawn new ones.
Level.prototype.update = function(asteroids) {
    if (asteroids.length == 0) {
        this.level++;
        this.levelPowerups = 0;
        for (let i = 0; i < this.level; i++) {
            asteroids.push(Asteroid.random());
        }   
    }
};

// The position of the score display.
Level.RENDER_COORDS = new Pt(10, 20);

// Render the score display in the top corner.
Level.prototype.render = function(context, playerPos) {
    let message = "Level: " + this.level;
    if (!this.cheated) {
        message = "Score: " + this.score + "     " + message;
    }
    if (playerPos.x < 180 && playerPos.y < 60) {
        context.globalAlpha = TRANSPARENT_ALPHA;
    }
    context.fillStyle = "white";
    context.font = "15px 'Bungee'";
    context.fillText(message, Level.RENDER_COORDS.x, Level.RENDER_COORDS.y);
    let x = Level.RENDER_COORDS.x + 10;
    let y = Level.RENDER_COORDS.y + 23;
    context.lineWidth = Player.outline.WIDTH;
    for (let i = 0; i < this.lives; i++) {
        Player.drawPlayer(context, TAU/2, new Pt(x, y));
        x += 20;
    };
    context.globalAlpha = 1;
};

// Tracks the number of frames for which execution is paused.
function StopFrames() {
    this.stopFrames = 0;
}

StopFrames.PAUSE_DURATION = 0.1 * FPS;
StopFrames.prototype.pause = function() {
    this.stopFrames = StopFrames.PAUSE_DURATION;
};
StopFrames.prototype.update = function() {
    if (this.isPaused()) {
        this.stopFrames--;
    }
};

StopFrames.prototype.isPaused = function() {
    return (this.stopFrames > 0);
}

// Keeps track of all game state.
function Game(context) {
    // The canvas rendering context.
    this.context = context;
    // The width of the canvas.
    this.canvWidth = context.canvas.width;
    // The height of the canvas.
    this.canvHeight = context.canvas.height;
    // Tracks key information.
    this.keys = new KeyTracker();
    // Tracks mouse information.
    this.mouse = new MouseTracker(context.canvas);
    // The player.
    this.player = new Player(this.canvWidth, this.canvHeight);
    // The list of asteroids.
	this.asteroids = [];
    // The set of asteroids that are currently being targeted by bullets with aimbot.
    this.asteroidTargets = new Set();
    // The list of bullets.
    this.bullets = [];
    // The list of particles.
	this.particles = [];
    // The number of frames to halt execution for.
    this.stopFrames = new StopFrames();
    // The list of powerup objects currently on the screen.
    this.powerups = [];
    this.timeStop = new TimeStopEffect();
    this.aimbot = new AimbotEffect();
    this.scatter = new ScatterEffect();
    this.tripleBullet = new TripleBulletEffect();
    this.repel = new RepelEffect();
    // Level data.
	this.level = new Level();
    // Settings data.
    this.settings = new Settings();
    // Whether the game is stopped.
    this.stopped = false;
}

// Handle controls specifically related to moving the player.
Game.prototype.playerControls = function() {
    if (this.settings.doMouseControls) {
        this.player.dir = this.mouse.pos.subtract(this.player.pos).direction();
    } else {
        if (this.keys.down("ArrowLeft") || this.keys.down("a")) {
            this.player.dirDrift -= Player.ANGULAR_ACCELERATION;
        }
        if (this.keys.down("ArrowRight") || this.keys.down("d")) {
            this.player.dirDrift += Player.ANGULAR_ACCELERATION;
        }
    }
    if (this.keys.down("ArrowUp") || this.keys.down("w")) {
        this.player.vel = this.player.vel.add(Pt.polar(Player.ACCELERATION, this.player.dir));
        for (let i = 0; i < exhaustParticle.RATE; i++) {
            this.spawnExhaust();
        }
    }
    if (this.keys.down("ArrowDown") || this.keys.down("s")) {
        this.player.vel = this.player.vel.subtract(Pt.polar(Player.ACCELERATION, this.player.dir));
    }
    if (!this.player.isDead() && (this.keys.newDown(" ") || this.keys.newDown("x"))) {
        this.fire();
    }
};

// Handle controls specifically related to cheats.
Game.prototype.cheatControls = function() {
    if (this.keys.newDown("p")) {
        this.level.cheated = true;
        // Activate a powerup effect chosen by the user.
        this[prompt()].activate();
    }
    if (this.keys.down("l")) {
        this.level.cheated = true;
        this.asteroids.push(new Asteroid(10, new Pt(0, 0), Pt.polar(Asteroid.SPEED, random.direction())));
    }
    if (this.keys.newDown("t")) {
        this.level.cheated = true;
        this.spawnPowerup();
    }
};

// Handle the controls.
Game.prototype.controls = function() {
    if (this.player.deathFrames >= 0) {
        this.playerControls();
    }
    if (this.keys.down("Escape")) {
        this.stop();
    }
    if (this.settings.allowCheats) {
        this.cheatControls();
    }
};

// Translate the context.
Game.prototype.doScreenShake = function() {
    if (this.stopFrames.stopFrames > 0) {
        this.context.translate(
            random.offset() * 10,
            random.offset() * 10);
    }
};

// Spawn an exhaust particle behind the player.
Game.prototype.spawnExhaust = function() {
    let playerDirection = this.player.dir;
    let pos = this.player.pos.subtract(Pt.polar(Player.EXHAUST_POSITION, playerDirection));
    let dir = playerDirection + exhaustParticle.SPREAD * random.offset();
    let magnitude = Math.random() * this.player.vel.magnitude();
    this.particles.push(exhaustParticle.make(pos, Pt.polar(-magnitude, dir), this.timeStop));
}

// Spawn a bullet.
Game.prototype.spawnBullet = function(dir) {
    let pos = Pt.polar(Player.FIRE_POSITION, dir).add(this.player.pos);
    let [target, vel] = this.aimbot.guide(this, pos, dir);
    if (target != null) {
        if (this.asteroidTargets.has(target)) {
            throw "Shouldn't have targeted already-targeted asteroid";
        }
        this.asteroidTargets.add(target);
    }
    this.bullets.push(new Bullet(pos, vel, dir, target));
};

Game.prototype.fire = function() {
    for (let angle of this.tripleBullet.angles()) {
        this.spawnBullet(this.player.dir + angle);
    }
};

// Spawn a powerup.
Game.prototype.spawnPowerup = function() {
    let Powerup;
    do {
        Powerup = random.choice(ALL_POWERUPS);
    } while (Powerup == LifeObject && this.level.lives + this.level.lifePowerups >= Level.MAX_LIVES);
    this.level.powerups++;
    this.level.levelPowerups++;
    if (Powerup == LifeObject) {
        this.level.lifePowerups++;
    }
    this.powerups.push(new Powerup(new Pt(0, 0), random.direction()));
};

// The chance that a powerup will spawn on any given frame.
Game.POWERUP_RATE = 1/3000;
// The minimum score for a powerup to spawn.
Game.POWERUP_THRESHOLD = 5;

// The color of the canvas.
Game.BG_COLOR = "black";
// The color of the canvas when the game is paused
// as a result of hitting an asteroid.
Game.FLASH_COLOR = "#444444";

Game.prototype.clearPowerups = function() {
    for (let powerup of [
        this.timeStop,
        this.aimbot,
        this.scatter,
        this.tripleBullet,
        this.repel,
    ]) {
        powerup.clear();
    }
};

// Return whether it is OK to spawn a powerup right now.
Game.prototype.canSpawnPowerup = function() {
    return this.level.levelPowerups < Level.MAX_POWERUPS_PER_LEVEL
        && this.level.powerups < Level.MAX_POWERUPS
        && this.level.score >= Game.POWERUP_THRESHOLD;
};

// Update the game state.
Game.prototype.update = function() {
    this.stopFrames.update();
    if (this.stopFrames.isPaused()) {
        return;
    }
    this.player.update(this.canvWidth, this.canvHeight);
    flatMapEach(this.asteroids,
        asteroid => asteroid.update(
            this.canvWidth,
            this.canvHeight,
            this.player,
            this.bullets,
            this.level,
            this.settings.doCollisionFlash,
            this.stopFrames,
            this.timeStop.speed(),
            this.scatter.isActive(),
            this.repel,
            () => this.clearPowerups(),
            this.particles,
            this.asteroidTargets));
    filterEach(this.bullets,
        bullet => bullet.update(this.canvWidth, this.canvHeight, this.timeStop.speed(), this.asteroidTargets));
    filterEach(this.particles,
        particle => particle.update(this.timeStop.speed(), this.canvWidth, this.canvHeight));
    filterEach(this.powerups, powerup => {
        let alive = powerup.update(this);
        if (!alive) {
            this.level.powerups--;
        }
        return alive;
    });
	
	this.tick++;
    if (this.canSpawnPowerup() && Math.random() < Game.POWERUP_RATE) {
        this.spawnPowerup();
    }
    this.level.update(this.asteroids);
    this.timeStop.update();
    this.aimbot.update();
    this.scatter.update();
    this.tripleBullet.update();
    this.repel.update();
};

// Clear the canvas.
Game.prototype.clear = function() {
    this.context.fillStyle = this.stopFrames.isPaused()
                           ? Game.FLASH_COLOR
                           : Game.BG_COLOR;
    this.context.fillRect(0, 0, this.canvWidth, this.canvHeight);
};

// Render things to the canvas.
Game.prototype.render = function() {
    this.context.save();
    this.doScreenShake();
    this.clear();
    this.level.render(this.context, this.player.pos);
    for (let asteroid of this.asteroids) {
        asteroid.render(
            this.context,
            this.repel.colorAsteroid(asteroid.pos, this.player.pos)
        );
    }
    for (let bullet of this.bullets) {
        bullet.render(this.context);
    }
	for (let particle of this.particles) {
		particle.render(this.context);
	}
    for (let powerup of this.powerups) {
        powerup.render(this.context);
    }
    this.player.render(this.context, this.repel);
    this.context.restore();
};

// Start playing the game.
Game.prototype.start = function() {
    let self = this;
    function tick() {
        self.controls();
        self.update();
        self.render();
        if (!self.stopped) {
            requestAnimationFrame(tick);
        }
    }
    tick();
};

// Stop playing the game.
Game.prototype.stop = function() {
    this.stopped = true;
};

function main() {
    let canvas = document.getElementById("canvas");
    let context = canvas.getContext("2d");
    let game = new Game(context);
    window.mainGame = game;
    game.start();
}

main();