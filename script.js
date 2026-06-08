// ----------------------------------------------------------------
// script.js
// author  : Emre Baytimur
// date    : 7 June 2026
// ----------------------------------------------------------------
// What this script does:
//   1. Runs the hero ball animation (drop onto video -> fade -> respawn -> land on CTA)
//   2. Handles the lineup builder (Alex picks a formation vs 4-4-2)
//   3. Runs the 10-second match sim and shows Goal / Miss result
//   4. Routes a goal to the download page
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// CONFIG  — every tunable value lives here, nothing hardcoded below
// ----------------------------------------------------------------
const CONFIG = {
  // -- hero ball animation --
  // Act 1: after a short delay the ball drops from the top onto the video,
  //        then fades out and the video starts playing.
  // Act 2: when the video ENDS, the ball respawns just below it and drops
  //        onto the CTA button (with a small settle bounce).
  ballStartDelayMs:  250,      // pause after load before the ball appears + drops
  ballDropToVideoMs: 720,      // fall-in from off-screen top onto the video
  ballFadeMs:        260,      // fade-out once the user taps to play
  ballRespawnFallMs: 820,      // drop from under the video down onto the CTA
  ballSettleHopPx:   26,       // height of the little bounce when it hits the CTA
  ballSettleMs:      170,      // duration of each half of that settle bounce
  ballRespawnLeadMs: 800,      // ball starts dropping this long BEFORE the video ends
  ballRiseEase:  "cubic-bezier(0,.2,.35,1)",   // hop up: decelerate toward the apex
  ballFallEase:  "cubic-bezier(.45,0,1,1)",    // fall down: accelerate under gravity

  // -- match sim (top-down passing build-up, then a shot) --
  simDurationMs:   10000,      // length of the match sim
  simKickoffDropMs:  450,      // ball drop-in at kickoff
  passSettleFrac:    0.22,     // fraction of each pass spent settling at the receiver
  ballHopScale:      0.6,      // how much the ball "lofts" (grows) mid-pass, 0 = flat
  attackPushFrac:    0.07,     // how far the attacking team drifts upfield (0-1 of height)
  defendDropFrac:    0.035,    // how far the defending team drops back
  tokensPerTeam:     11,       // players drawn per side
  celebrateMs:      1400,      // pause on "Well Done" before routing to the store

  // -- fixed game facts --
  opponentFormation: "4-4-2",  // the fixed opponent shape

  // store links — "Get the game" sends the user to the right one for their device
  storeLinks: {
    ios:     "https://apps.apple.com/tr/app/efsane-başkan/id6743401408",
    android: "https://play.google.com/store/apps/details?id=com.nosurrenderstudio.efsanebaskan",
    desktop: "https://play.google.com/store/apps/details?id=com.nosurrenderstudio.efsanebaskan&pcampaignid=web_share",
  },

  // -- canvas colours (named so nothing is hardcoded in the draw code) --
  // aligned to the site palette: emerald = you, deep red = opponent, neon = lines
  colors: {
    pitchGreen: "#0A1F17",     // pitch fill (very dark green)
    lineColor:  "#10F3A5",     // neon pitch markings
    youToken:   "#0F8A4B",     // your team (emerald)
    oppToken:   "#991B1B",     // opponent (deep red)
    ballColor:  "#E2E8F0",     // the ball (fallback dot before the image loads)
  },
};

// goal chance per chosen formation against a 4-4-2 (0.0 - 1.0)
// ranking comes from real tactics sources; the numbers are my design heuristic
const FORMATION_GOAL_CHANCE = {
  "4-2-3-1": 1.00,   // optimal counter — always scores
  "4-3-3":   0.80,   // strong, three-midfield press
  "4-4-2":   0.40,   // mirror match, no structural edge
  "5-4-1":   0.15,   // too defensive, cedes midfield
};

// normalised token positions (x and y in 0.0 - 1.0); y is measured from the top
// your team attacks upward (toward the red goal at the top of the canvas)
const OPPONENT_LAYOUT = [
  { x: 0.50, y: 0.07 },                                          // GK
  { x: 0.20, y: 0.22 }, { x: 0.40, y: 0.22 }, { x: 0.60, y: 0.22 }, { x: 0.80, y: 0.22 }, // back four
  { x: 0.20, y: 0.36 }, { x: 0.40, y: 0.36 }, { x: 0.60, y: 0.36 }, { x: 0.80, y: 0.36 }, // midfield four
  { x: 0.40, y: 0.50 }, { x: 0.60, y: 0.50 },                    // two up top
];

const FORMATION_LAYOUTS = {
  "4-2-3-1": [
    { x: 0.50, y: 0.93 },
    { x: 0.20, y: 0.78 }, { x: 0.40, y: 0.78 }, { x: 0.60, y: 0.78 }, { x: 0.80, y: 0.78 },
    { x: 0.38, y: 0.66 }, { x: 0.62, y: 0.66 },
    { x: 0.25, y: 0.54 }, { x: 0.50, y: 0.54 }, { x: 0.75, y: 0.54 },
    { x: 0.50, y: 0.42 },
  ],
  "4-3-3": [
    { x: 0.50, y: 0.93 },
    { x: 0.20, y: 0.78 }, { x: 0.40, y: 0.78 }, { x: 0.60, y: 0.78 }, { x: 0.80, y: 0.78 },
    { x: 0.30, y: 0.64 }, { x: 0.50, y: 0.64 }, { x: 0.70, y: 0.64 },
    { x: 0.25, y: 0.48 }, { x: 0.50, y: 0.46 }, { x: 0.75, y: 0.48 },
  ],
  "4-4-2": [
    { x: 0.50, y: 0.93 },
    { x: 0.20, y: 0.78 }, { x: 0.40, y: 0.78 }, { x: 0.60, y: 0.78 }, { x: 0.80, y: 0.78 },
    { x: 0.20, y: 0.64 }, { x: 0.40, y: 0.64 }, { x: 0.60, y: 0.64 }, { x: 0.80, y: 0.64 },
    { x: 0.40, y: 0.50 }, { x: 0.60, y: 0.50 },
  ],
  "5-4-1": [
    { x: 0.50, y: 0.93 },
    { x: 0.15, y: 0.80 }, { x: 0.32, y: 0.80 }, { x: 0.50, y: 0.80 }, { x: 0.68, y: 0.80 }, { x: 0.85, y: 0.80 },
    { x: 0.20, y: 0.66 }, { x: 0.40, y: 0.66 }, { x: 0.60, y: 0.66 }, { x: 0.80, y: 0.66 },
    { x: 0.50, y: 0.54 },
  ],
};

// ----------------------------------------------------------------
// SHARED STATE
// ----------------------------------------------------------------
var chosenFormation = null;   // the formation Alex picked, or null
var lastResultWasGoal = false; // remembers which result button to wire
var simInstantBall = false;   // true when the sim ball was handed off from the kickoff drop

// the sim ball is drawn as the real football image (same asset as the hero ball);
// preloaded once, with a white-dot fallback until it's ready
var simBallImg = new Image();
var simBallReady = false;
simBallImg.onload = function () { simBallReady = true; };
simBallImg.src = "assets/football.png";

// ----------------------------------------------------------------
// HERO BALL ANIMATION
// ----------------------------------------------------------------

// places the ball so its centre sits at (cx, cy) inside the hero
function placeBall(ball, cx, cy) {
  var half = ball.offsetWidth / 2;                               // centre, not corner
  ball.style.left = (cx - half) + "px";
  ball.style.top  = (cy - half) + "px";
}
// end of placeBall()

// returns an element's box relative to the hero, plus its centre point
function rectInHero(el, heroRect) {
  var r = el.getBoundingClientRect();
  return {
    top:    r.top  - heroRect.top,
    height: r.height,
    cx:     r.left - heroRect.left + r.width / 2,
    cy:     r.top  - heroRect.top  + r.height / 2,
  };
}
// end of rectInHero()

// moves the ball's centre to (x, y) over `ms`, with a per-phase vertical ease,
// linear spin, and a callback when the move finishes
function dropBallTo(ball, x, y, ms, spin, vEase, done) {
  ball.style.transition = "top "       + ms + "ms " + vEase + ", "
                        + "left "      + ms + "ms linear, "
                        + "transform " + ms + "ms linear";
  placeBall(ball, x, y);
  ball.style.transform = "rotate(" + spin + "deg)";
  if (done) { setTimeout(done, ms); }                           // chain the next phase
}
// end of dropBallTo()

// the video plays WITH sound, but only after a user gesture (browser policy). So
// the ball bounces on the video as a lure and the first tap starts it with sound.
var userWantsSound = true;
var videoTapped    = false;   // true once the first tap has started the video
var heroIdleActive = false;   // true while the ball bounces on the video, awaiting a tap
var heroTapWired   = false;   // the document tap handler is armed only once

// makes the corner button's icon + labels match the video's real mute state
function syncSoundToggle() {
  var video = document.getElementById("hero-video");
  var btn   = document.getElementById("video-sound-toggle");
  if (!video || !btn) { return; }                               // nothing to sync
  btn.textContent = video.muted ? "🔇" : "🔊";
  btn.setAttribute("aria-pressed", video.muted ? "false" : "true");
  btn.setAttribute("aria-label", video.muted ? "Unmute video" : "Mute video");
}
// end of syncSoundToggle()

// wires the corner speaker button: toggles sound and keeps the video playing
function wireSoundToggle() {
  var video = document.getElementById("hero-video");
  var btn   = document.getElementById("video-sound-toggle");

  // guard clause: nothing to wire
  if (!video || !btn) {
    return;                                                     // nothing to do
  }
  // end of if-block

  btn.addEventListener("click", function (e) {
    e.stopPropagation();                                        // don't re-trigger the wrap's play handler
    userWantsSound = video.muted;                               // turning sound ON?
    video.muted = !video.muted;

    // make sure it is actually playing when sound comes on (the tap is a gesture)
    if (!video.muted) {
      var p = video.play();
      if (p && p.catch) { p.catch(function () {}); }
    }
    // end of if-block

    syncSoundToggle();
  });
}
// end of wireSoundToggle()

// the ball bounces in place on the video until the user taps. stops the instant
// `heroIdleActive` goes false (a tap was registered).
function heroIdleBounce(ball, cx, restY) {
  heroIdleActive = true;
  var hop  = 30;
  var upMs = 360;
  var spin = 220;

  function up() {
    if (!heroIdleActive) { return; }                            // tapped -> stop
    spin += 50;
    dropBallTo(ball, cx, restY - hop, upMs, spin, CONFIG.ballRiseEase, function () {
      if (!heroIdleActive) { return; }
      spin += 50;
      dropBallTo(ball, cx, restY, Math.round(upMs * 0.9), spin, CONFIG.ballFallEase, up);
    });
  }
  // end of up()

  up();
}
// end of heroIdleBounce()

// arms a one-time "first tap anywhere" handler: it plays the video WITH SOUND
// (the tap is the gesture the browser needs), stops the lure bounce and fades the
// ball out. ACT 2 brings the ball back near the video's end.
function wireHeroTap(video, ball) {
  if (heroTapWired) { return; }
  heroTapWired = true;

  function go(e) {
    document.removeEventListener("pointerdown", go);
    document.removeEventListener("keydown", go);
    videoTapped = true;
    heroIdleActive = false;                                     // stop the lure bounce

    // the lure ball did its job — fade it out
    ball.style.transition = "opacity " + CONFIG.ballFadeMs + "ms ease";
    ball.style.opacity = "0";

    // if the tap landed on the sound toggle, let ITS handler play/unmute
    var onToggle = e && e.target && e.target.closest && e.target.closest("#video-sound-toggle");
    if (onToggle) { return; }

    userWantsSound = true;
    video.muted = false;                                        // the tap allows sound
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {                                      // blocked? fall back to muted
        video.muted = true;
        video.play().catch(function () {});
        syncSoundToggle();
      });
    }
    syncSoundToggle();
  }
  // end of go()

  document.addEventListener("pointerdown", go);
  document.addEventListener("keydown", go);
}
// end of wireHeroTap()

var heroBallStarted = false;   // guard so the sequence only ever runs once

// ACT 1: the ball drops onto the video and BOUNCES there as a "tap to play" lure.
// The first tap anywhere starts the video WITH SOUND (see wireHeroTap).
// ACT 2 (below): the ball drops onto the CTA shortly before the video ends.
function runHeroBall() {
  if (heroBallStarted) { return; }                              // run once only
  heroBallStarted = true;

  var hero  = document.querySelector(".hero");
  var ball  = document.getElementById("hero-ball");
  var video = document.getElementById("hero-video");
  var wrap  = document.getElementById("hero-video-wrap");
  var cta   = document.getElementById("cta");

  // guard clause: if any piece is missing, do nothing
  if (!hero || !ball || !video || !wrap || !cta) {
    return;                                                     // nothing to animate
  }
  // end of if-block

  ball.style.marginLeft = "0";                                  // we position by centre instead

  // arm the tap-to-play handler now (works even if the user taps mid-drop)
  wireHeroTap(video, ball);

  // respect reduced-motion: skip the drama, rest the ball on the CTA (tap still plays)
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settleBallOnCta(hero, ball, cta);
    return;                                                     // no animation
  }
  // end of if-block

  var heroRect = hero.getBoundingClientRect();
  var vid  = rectInHero(wrap, heroRect);                        // the video box (stays put after the still appears)
  var half = ball.offsetWidth / 2;

  // start above the hero, centred over the video, invisible
  ball.style.transition = "none";
  placeBall(ball, vid.cx, -half - 20);
  ball.style.transform = "rotate(0deg)";
  ball.style.opacity = "0";
  void ball.offsetWidth;                                        // commit before animating

  // after the start delay: reveal, fall onto the video, then bounce there as a lure
  setTimeout(function () {
    ball.style.transition = "opacity 160ms ease";
    ball.style.opacity = "1";

    var landY = vid.top + half + 6;                             // resting on the video
    dropBallTo(ball, vid.cx, landY, CONFIG.ballDropToVideoMs, 240, CONFIG.ballFallEase, function () {
      // landed -> bounce on the video until a tap plays it (unless already tapped)
      if (!videoTapped) { heroIdleBounce(ball, vid.cx, landY); }
    });
  }, CONFIG.ballStartDelayMs);

  // ACT 2: the ball starts dropping a beat BEFORE the video ends (timeupdate),
  // and placeholder.png swaps in when the video actually ends.
  var respawnFired = false;
  function maybeRespawn() {
    if (respawnFired || !video.duration || isNaN(video.duration)) { return; }
    var remainingMs = (video.duration - video.currentTime) * 1000;
    if (remainingMs <= CONFIG.ballRespawnLeadMs) {
      respawnFired = true;
      respawnBallToCta(hero, ball, wrap, cta);                  // drop from under the video onto the CTA
    }
    // end of if-block
  }
  // end of maybeRespawn()

  video.addEventListener("timeupdate", maybeRespawn);
  video.addEventListener("ended", function onEnded() {
    video.removeEventListener("ended", onEnded);
    // the video holds on its own last frame; hide the (now pointless) mute button
    var toggle = document.getElementById("video-sound-toggle");
    if (toggle) { toggle.hidden = true; }
    if (!respawnFired) {                                        // safety: very short clips
      respawnFired = true;
      respawnBallToCta(hero, ball, wrap, cta);
    }
    // end of if-block
  });
}
// end of runHeroBall()

// ACT 2 — the ball reappears just under the video and drops onto the CTA button,
// finishing with a small settle bounce so it reads as landing, not teleporting.
function respawnBallToCta(hero, ball, box, cta) {
  var heroRect = hero.getBoundingClientRect();                  // re-read: layout may have shifted
  var vid  = rectInHero(box, heroRect);
  var ctaR = rectInHero(cta, heroRect);
  var half = ball.offsetWidth / 2;

  // appear just below the video, centred on it
  ball.style.transition = "none";
  placeBall(ball, vid.cx, vid.top + vid.height + half + 6);
  ball.style.transform = "rotate(0deg)";
  void ball.offsetWidth;
  ball.style.opacity = "1";

  // fall onto the TOP of the CTA (ball's underside touches the button)
  var landY = ctaR.top - half + 4;
  dropBallTo(ball, ctaR.cx, landY, CONFIG.ballRespawnFallMs, 540, CONFIG.ballFallEase, function () {
    // little settle bounce: up a touch, then back down to rest
    dropBallTo(ball, ctaR.cx, landY - CONFIG.ballSettleHopPx, CONFIG.ballSettleMs, 560, CONFIG.ballRiseEase, function () {
      dropBallTo(ball, ctaR.cx, landY, CONFIG.ballSettleMs, 580, CONFIG.ballFallEase, null);
    });
  });
}
// end of respawnBallToCta()

// reduced-motion fallback: park the ball on the CTA with no movement
function settleBallOnCta(hero, ball, cta) {
  var heroRect = hero.getBoundingClientRect();
  var ctaR = rectInHero(cta, heroRect);
  var half = ball.offsetWidth / 2;
  ball.style.transition = "none";
  placeBall(ball, ctaR.cx, ctaR.top - half + 4);
  ball.style.transform = "rotate(0deg)";
  ball.style.opacity = "1";
}
// end of settleBallOnCta()

// arms the hero ball once the video knows its size (so the geometry is right)
function watchHero() {
  var video = document.getElementById("hero-video");

  // guard clause: no video -> nothing to drop onto
  if (!video) {
    return;                                                     // nothing to do
  }
  // end of if-block

  // metadata gives us the video's real dimensions; without it the rect can be 0
  if (video.readyState >= 1 && video.videoHeight) {
    runHeroBall();                                              // already known
    return;
  }
  // end of if-block

  video.addEventListener("loadedmetadata", runHeroBall, { once: true });
  // fallback in case metadata never fires (cached/odd browsers)
  setTimeout(runHeroBall, 1500);
}
// end of watchHero()

// ----------------------------------------------------------------
// BUILDER BALL — the ball's journey continues into the picker
// ----------------------------------------------------------------
// .hero is overflow:hidden so the hero ball can't leave it. A second ball lives
// inside .builder and takes over when Alex taps the CTA: it drops into the
// formation picker and bounces there until he chooses, then drops onto kickoff.

var builderBallArmed = false;   // CTA tapped -> ball brought into the picker
var builderBallIdle  = false;   // true while it bounces, waiting for a choice
var builderTourActive = false;  // true while the ball is touring the proof cards

// whether the user asked the OS to reduce motion
function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
// end of prefersReducedMotion()

// CTA tapped: the ball leaves the CTA and tours the page as ONE continuous motion
// — it hops once on each proof card (LIVE NOW, REAL CASH, FAIR, SKILL), scrolling
// so each one is centred (so mobile users actually SEE them), then lands on the
// kickoff button and bounces there until a formation is chosen. The page scroll
// and a viewport-fixed ball are driven from the SAME eased clock, so they stay
// locked together the whole way down (no disconnect).
function startBuilderBall() {
  if (builderBallArmed) { return; }                             // first tap only
  builderBallArmed = true;

  var builder  = document.getElementById("builder");
  var ball     = document.getElementById("builder-ball");
  var kickoff  = document.getElementById("kickoff-btn");
  var cta      = document.getElementById("cta");
  var heroBall = document.getElementById("hero-ball");

  // guard clause: pieces missing, or motion is reduced (native scroll handles it)
  if (!builder || !ball || !kickoff || !cta || prefersReducedMotion()) {
    return;                                                     // nothing to animate
  }
  // end of if-block

  var half    = ball.offsetWidth / 2;
  var ctaRect = cta.getBoundingClientRect();

  // hand the journey off from the hero ball to this one (no two balls on screen)
  if (heroBall) { heroBall.style.opacity = "0"; }

  // make the ball follow the viewport so the scroll underneath can't detach it
  ball.style.position = "fixed";
  ball.style.margin = "0";
  ball.style.transition = "none";
  ball.style.opacity = "1";
  placeBall(ball, ctaRect.left + ctaRect.width / 2, ctaRect.top - half - 2);
  ball.style.transform = "rotate(0deg)";

  // visit each proof card (two hops each, so they're readable), then finish on
  // the kickoff button — scrolled so the builder TITLE is in view, not cut off
  builderTourActive = true;
  var cards = Array.prototype.slice.call(document.querySelectorAll(".proof-card"));
  var i = 0;
  function next() {
    if (!builderTourActive) { return; }                          // a choice cancelled the tour
    if (i < cards.length) {
      // centre the card and hop on it TWICE (slower descent + dwell, so it's readable)
      glideBallToEl(ball, cards[i++], { vhFrac: 0.5, anchorCenter: true, T: 760, hops: 2, done: next });
    } else {
      // land on kickoff, but anchor the scroll to the builder TOP so the heading shows
      glideBallToEl(ball, kickoff, { scrollEl: builder, vhFrac: 0.07, T: 640, hops: 0, done: function () {
        builderTourActive = false;                               // tour done
        handoffBuilderBallToIdle(builder, ball, kickoff);        // bounce on the button
      } });
    }
  }
  // end of next()

  next();
}
// end of startBuilderBall()

// glides the viewport-fixed ball onto `landEl`, driving the page scroll from the
// SAME eased clock. opts:
//   vhFrac       — where the scroll anchor sits in the viewport (0 = top, 0.5 = middle)
//   scrollEl     — element the scroll aligns to (defaults to landEl)
//   anchorCenter — align the anchor's CENTRE (true) or its TOP (false) to vhFrac
//   T            — duration (ms)
//   hops         — number of in-place hops on arrival (0 = none)
//   done         — called when finished
function glideBallToEl(ball, landEl, opts) {
  var scrollEl = opts.scrollEl || landEl;
  var startScroll = window.pageYOffset;
  var vh          = window.innerHeight;
  var maxScroll   = Math.max(0, document.documentElement.scrollHeight - vh);

  // scroll so the anchor sits at vhFrac of the viewport
  var sRect      = scrollEl.getBoundingClientRect();
  var sAnchorAbs = sRect.top + startScroll + (opts.anchorCenter ? sRect.height / 2 : 0);
  var targetScroll = clamp(sAnchorAbs - vh * opts.vhFrac, 0, maxScroll);

  // land the ball just on top of landEl at that target scroll
  var lRect = landEl.getBoundingClientRect();
  var half  = ball.offsetWidth / 2;
  var endX  = lRect.left + lRect.width / 2;
  var endY  = (lRect.top + startScroll - targetScroll) - half - 2;

  // current (fixed) ball centre = where the previous segment left it
  ball.style.transition = "none";
  var cur    = ball.getBoundingClientRect();
  var startX = cur.left + cur.width / 2;
  var startY = cur.top  + cur.height / 2;

  var htmlEl = document.documentElement;
  var prevBehavior = htmlEl.style.scrollBehavior;
  htmlEl.style.scrollBehavior = "auto";                         // exact per-frame scroll

  var t0 = performance.now();
  function frame(now) {
    if (!builderTourActive) {                                   // cancelled (a choice was made)
      htmlEl.style.scrollBehavior = prevBehavior;
      return;
    }
    // end of if-block

    var t = clamp((now - t0) / opts.T, 0, 1);
    var e = easeInOut(t);
    window.scrollTo(0, startScroll + (targetScroll - startScroll) * e);
    placeBall(ball, startX + (endX - startX) * e, startY + (endY - startY) * e);
    ball.style.transform = "rotate(" + (e * 460) + "deg)";

    if (t < 1) {
      requestAnimationFrame(frame);
      return;                                                   // still gliding
    }
    // end of if-block

    htmlEl.style.scrollBehavior = prevBehavior;                 // restore smooth scroll
    if (opts.hops > 0) {
      bounceBall(ball, endX, endY, opts.hops, opts.done);
    } else if (opts.done) {
      opts.done();
    }
    // end of if-block
  }
  // end of frame()

  requestAnimationFrame(frame);
}
// end of glideBallToEl()

// `hops` quick hops in place (ball stays viewport-fixed; the page is static here)
function bounceBall(ball, cx, restY, hops, done) {
  function hop(n) {
    if (!builderTourActive) { return; }                          // cancelled mid-hop
    dropBallTo(ball, cx, restY - 26, 240, 520, CONFIG.ballRiseEase, function () {
      if (!builderTourActive) { return; }
      dropBallTo(ball, cx, restY, 260, 570, CONFIG.ballFallEase, function () {
        if (!builderTourActive) { return; }
        if (n > 1) { hop(n - 1); }
        else if (done) { done(); }
      });
    });
  }
  // end of hop()

  hop(hops);
}
// end of bounceBall()

// switches the ball from viewport-fixed back to absolute-in-builder (so it tracks
// the button if the page scrolls) and starts the idle bounce on the kickoff button
function handoffBuilderBallToIdle(builder, ball, kickoff) {
  var bRect = builder.getBoundingClientRect();
  var kb    = rectInHero(kickoff, bRect);
  var half  = ball.offsetWidth / 2;
  var restY = kb.top - half - 2;                                // sit just on top of the button

  ball.style.position = "absolute";
  ball.style.transition = "none";
  ball.style.opacity = "1";
  placeBall(ball, kb.cx, restY);
  void ball.offsetWidth;
  builderIdleBounce(ball, kb.cx, restY);
}
// end of handoffBuilderBallToIdle()

// bounces the builder ball in place until `builderBallIdle` goes false
function builderIdleBounce(ball, cx, restY) {
  builderBallIdle = true;
  var hop  = 26;
  var upMs = 340;
  var spin = 200;

  function hopUp() {
    if (!builderBallIdle) { return; }                           // a choice was made -> stop
    spin += 50;
    dropBallTo(ball, cx, restY - hop, upMs, spin, CONFIG.ballRiseEase, function () {
      if (!builderBallIdle) { return; }
      spin += 50;
      dropBallTo(ball, cx, restY, Math.round(upMs * 0.9), spin, CONFIG.ballFallEase, hopUp);
    });
  }
  // end of hopUp()

  hopUp();
}
// end of builderIdleBounce()

// a formation was chosen: stop bouncing and drop onto the kickoff button
function dropBuilderBallToKickoff() {
  var wasTouring = builderTourActive;                           // picked mid proof-tour?
  builderTourActive = false;                                    // cancel the tour
  builderBallIdle = false;                                      // stop the idle bounce

  var builder = document.getElementById("builder");
  var ball    = document.getElementById("builder-ball");
  var kickoff = document.getElementById("kickoff-btn");

  // guard clause: only when the CTA path armed the ball (and motion isn't reduced)
  if (!builder || !ball || !kickoff || !builderBallArmed || prefersReducedMotion()) {
    return;                                                     // nothing to do
  }
  // end of if-block

  document.documentElement.style.scrollBehavior = "";          // the tour may have left it off
  ball.style.position = "absolute";                            // back into the builder's space

  // re-read geometry: enabling kickoff / picking may have reflowed the layout
  var bRect = builder.getBoundingClientRect();
  var kb    = rectInHero(kickoff, bRect);
  var half  = ball.offsetWidth / 2;
  var landY = kb.top - half + 4;                                // rest on top of the kickoff button

  ball.style.opacity = "1";
  // if the choice interrupted the tour, snap the ball above the button first so the
  // drop reads cleanly (it was viewport-fixed mid-glide a moment ago)
  if (wasTouring) {
    ball.style.transition = "none";
    placeBall(ball, kb.cx, kb.top - half - 44);
    void ball.offsetWidth;
  }
  // end of if-block

  dropBallTo(ball, kb.cx, landY, CONFIG.ballRespawnFallMs, 520, CONFIG.ballFallEase, function () {
    // small settle bounce so it reads as landing
    dropBallTo(ball, kb.cx, landY - CONFIG.ballSettleHopPx, CONFIG.ballSettleMs, 540, CONFIG.ballRiseEase, function () {
      dropBallTo(ball, kb.cx, landY, CONFIG.ballSettleMs, 560, CONFIG.ballFallEase, null);
    });
  });
}
// end of dropBuilderBallToKickoff()

// ----------------------------------------------------------------
// LINEUP BUILDER — formation choice
// ----------------------------------------------------------------

// wires up the four formation cards and the kickoff button
function wireBuilder() {
  var cards   = document.querySelectorAll(".formation-card");
  var kickoff = document.getElementById("kickoff-btn");

  // guard clause: builder not on the page
  if (cards.length === 0 || !kickoff) {
    return;                                                     // nothing to wire
  }
  // end of if-block

  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener("click", function () {
      selectCard(this, cards, kickoff);                         // pick this formation
    });
  }
  // end of for i loop

  kickoff.addEventListener("click", function () {
    if (prefersReducedMotion()) {
      startSim();                                               // no drop animation
      return;
    }
    // end of if-block
    kickoffWithBall();                                          // ball drops into the pitch, then plays
  });
}
// end of wireBuilder()

// kick off: the ball on the kickoff button drops into the simulation pitch and
// BECOMES the white sim ball. We drive the scroll + a viewport-fixed ball from
// one eased clock (same trick as the CTA move), then start the sim with the ball
// already on the pitch so the players play with that very ball.
function kickoffWithBall() {
  var ball    = document.getElementById("builder-ball");
  var kickoff = document.getElementById("kickoff-btn");
  var arena   = document.getElementById("arena");
  var canvas  = document.getElementById("pitch");

  // guard clause: missing pieces -> just run the plain sim
  if (!ball || !kickoff || !arena || !canvas || !chosenFormation) {
    startSim();
    return;
  }
  // end of if-block

  builderBallIdle = false;                                      // stop bouncing on the button

  // reveal the arena first so the canvas has a real size and the page its full height
  arena.hidden = false;
  void arena.offsetHeight;                                      // force layout

  var half        = ball.offsetWidth / 2;
  var startScroll = window.pageYOffset;
  var vh          = window.innerHeight;

  // where the white sim ball begins, in canvas-internal coords (the first passer)
  var w = canvas.width, h = canvas.height;
  var blueBase  = toPixels(FORMATION_LAYOUTS[chosenFormation], w, h);
  var passSeq   = buildPassSequence(blueBase, w, h);
  var startNode = blueBase[passSeq[0]];                         // {x,y} in the 720x440 space

  // convert that point to the viewport, accounting for the canvas display scale
  var cRect   = canvas.getBoundingClientRect();
  var spotVX  = cRect.left + (startNode.x / w) * cRect.width;
  var spotVY  = cRect.top  + (startNode.y / h) * cRect.height;
  var spotAbsY = spotVY + startScroll;                          // document-space

  // scroll so the landing spot sits at viewport centre, then re-read the end Y
  var maxScroll    = Math.max(0, document.documentElement.scrollHeight - vh);
  var targetScroll = clamp(spotAbsY - vh * 0.5, 0, maxScroll);
  var endX = spotVX;
  var endY = spotAbsY - targetScroll;                           // ball centre lands on the spot

  // START: on top of the kickoff button (works whether or not it was idling there)
  var kRect  = kickoff.getBoundingClientRect();
  var startX = kRect.left + kRect.width / 2;
  var startY = kRect.top - half - 2;

  // viewport-fixed so the scroll underneath can't detach it
  ball.style.position = "fixed";
  ball.style.margin = "0";
  ball.style.transition = "none";
  ball.style.opacity = "1";
  placeBall(ball, startX, startY);
  ball.style.transform = "rotate(0deg)";

  var htmlEl = document.documentElement;
  var prevBehavior = htmlEl.style.scrollBehavior;
  htmlEl.style.scrollBehavior = "auto";

  var T  = 760;
  var t0 = performance.now();
  function frame(now) {
    var t = clamp((now - t0) / T, 0, 1);
    var e = easeInOut(t);                                       // ONE clock for scroll + ball
    window.scrollTo(0, startScroll + (targetScroll - startScroll) * e);
    placeBall(ball, startX + (endX - startX) * e, startY + (endY - startY) * e);
    ball.style.transform = "rotate(" + (e * 640) + "deg)";

    if (t < 1) {
      requestAnimationFrame(frame);
      return;                                                   // still falling in
    }
    // end of if-block

    htmlEl.style.scrollBehavior = prevBehavior;

    // hand off to the canvas ball: fade the image and start the sim with the ball
    // already on the pitch (no scale-in) so it reads as the same ball
    ball.style.transition = "opacity 220ms ease";
    ball.style.opacity = "0";
    startSim({ skipScroll: true, instantBall: true });
  }
  // end of frame()

  requestAnimationFrame(frame);
}
// end of kickoffWithBall()

// marks one card as selected and enables the kickoff button
function selectCard(card, cards, kickoff) {
  // clear the previous selection
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove("selected");
    cards[i].setAttribute("aria-checked", "false");
  }
  // end of for i loop

  card.classList.add("selected");
  card.setAttribute("aria-checked", "true");

  chosenFormation = card.getAttribute("data-formation");        // remember the choice
  kickoff.disabled = false;
  kickoff.textContent = "Kick off vs " + CONFIG.opponentFormation;

  dropBuilderBallToKickoff();                                   // ball drops onto kickoff
}
// end of selectCard()

// ----------------------------------------------------------------
// MATCH SIMULATION
// ----------------------------------------------------------------

// decides whether the chosen formation scores against the 4-4-2
function simulateMatch(chosen) {
  // -- Step 1: look up this formation's goal chance --
  var goalChance = FORMATION_GOAL_CHANCE[chosen];               // 0.0 - 1.0

  // guard clause: unknown formation should never happen, but bail safely
  if (goalChance === undefined) {
    return false;                                               // treat as a miss
  }
  // end of if-block

  // -- Step 2: roll a random number and compare --
  var roll = Math.random();                                     // 0.0 - 1.0
  var didScore = roll < goalChance;                             // true = goal
  return didScore;
}
// end of simulateMatch()

// kicks off the visual 10-second match and reveals the result at the end.
// opts.skipScroll  — caller already scrolled the arena into view
// opts.instantBall — the ball was just delivered onto the pitch, so don't scale it in
function startSim(opts) {
  opts = opts || {};

  // guard clause: no formation chosen yet
  if (!chosenFormation) {
    return;                                                     // nothing to simulate
  }
  // end of if-block

  var arena   = document.getElementById("arena");
  var canvas  = document.getElementById("pitch");
  var overlay = document.getElementById("result-overlay");
  var scoreEl = document.getElementById("score");
  var timerEl = document.getElementById("timer");

  simInstantBall = !!opts.instantBall;                          // hand-off: ball already on the pitch

  arena.hidden   = false;
  overlay.hidden = true;
  scoreEl.textContent = "0 – 0";
  if (!opts.skipScroll) {
    arena.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  // end of if-block

  // decide the outcome up front, then animate toward it
  var didScore = simulateMatch(chosenFormation);

  var ctx = canvas.getContext("2d");
  var w = canvas.width;
  var h = canvas.height;

  // pre-compute the base (kickoff) pixel positions for both teams
  var redBase  = toPixels(OPPONENT_LAYOUT, w, h);
  var blueBase = toPixels(FORMATION_LAYOUTS[chosenFormation], w, h);

  // the ball is passed between REAL players of your team (a build-up that adapts
  // to the chosen formation), then struck at goal. passSeq holds player indices.
  var passSeq  = buildPassSequence(blueBase, w, h);
  // the keeper stands at the centre of the goal (OPPONENT_LAYOUT[0], ~0.50,0.07).
  // a GOAL must beat him into a corner of the net (past the goal line, y < ~0.036);
  // a MISS goes straight at the keeper and is SAVED — a ball at the keeper is never a goal.
  var goalCorner = (Math.random() < 0.5 ? 0.40 : 0.60);         // left or right corner
  var shotSpot = didScore ? { x: goalCorner * w, y: 0.022 * h } // into the corner of the net
                          : { x: 0.50 * w,       y: 0.070 * h };// straight at the keeper -> saved
  var lastSeg  = passSeq.length - 1;                            // the shot is the final segment
  var scoreShown = false;

  var startTime = Date.now();

  // the animation loop
  // note: we read Date.now() (true wall clock) so the match always lasts
  // simDurationMs regardless of how the browser paces requestAnimationFrame
  function frame() {
    var now = Date.now();
    var elapsed = now - startTime;
    var t = clamp(elapsed / CONFIG.simDurationMs, 0, 1);        // 0 -> 1 over the match

    timerEl.textContent = formatTime(elapsed);

    // live player positions (idle jitter + an upfield drift over the match)
    var blue = livePositions(blueBase, now, t, -CONFIG.attackPushFrac * h);
    var red  = livePositions(redBase,  now, t, -CONFIG.defendDropFrac * h);

    // the ball's route IS the live positions of the passing players, then the
    // shot — so it travels player-to-player instead of through empty space
    var ballPath = [];
    for (var p = 0; p < passSeq.length; p++) {
      ballPath.push(blue[passSeq[p]]);                          // current spot of each receiver
    }
    // end of for p loop
    ballPath.push(shotSpot);                                    // final node: the shot at goal
    var ball = ballAlongPath(ballPath, t);

    drawPitch(ctx, w, h);
    drawTeam(ctx, red,  CONFIG.colors.oppToken);
    drawTeam(ctx, blue, CONFIG.colors.youToken);
    drawBall(ctx, ball.x, ball.y, t, ball.hop);

    // flip the scoreline the instant the shot is buried
    if (didScore && ball.seg === lastSeg && ball.arrived && !scoreShown) {
      scoreEl.textContent = "1 – 0";
      scoreShown = true;
    }
    // end of if-block

    // keep animating until the match clock runs out
    if (t < 1) {
      requestAnimationFrame(frame);
      return;                                                   // not finished yet
    }
    // end of if-block

    showResult(didScore);                                       // match over -> reveal
  }
  // end of frame()

  requestAnimationFrame(frame);
}
// end of startSim()

// chooses which of your players knock the ball around, as a list of indices.
// progression spots run deep -> advanced with left/right switches; each spot
// snaps to the NEAREST real player in the chosen formation (no player reused),
// so the route always lands on actual tokens whatever the shape.
function buildPassSequence(blueBase, w, h) {
  var spots = [
    { x: 0.50, y: 0.90 },   // deep — keeper / centre-back starts it
    { x: 0.26, y: 0.70 },   // out to the left
    { x: 0.58, y: 0.57 },   // back through the middle
    { x: 0.80, y: 0.47 },   // switch to the right
    { x: 0.44, y: 0.40 },   // inside, into the channel
  ];
  var used = {};
  var seq = [];
  for (var s = 0; s < spots.length; s++) {
    var tx = spots[s].x * w;
    var ty = spots[s].y * h;
    var best = -1;
    var bestD = Infinity;
    for (var i = 0; i < blueBase.length; i++) {
      if (used[i]) { continue; }                                // each player passes once
      var dx = blueBase[i].x - tx;
      var dy = blueBase[i].y - ty;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
      // end of if-block
    }
    // end of for i loop
    if (best >= 0) { used[best] = true; seq.push(best); }
    // end of if-block
  }
  // end of for s loop
  return seq;
}
// end of buildPassSequence()

// returns the ball's live position along the multi-segment path at progress t.
// each segment is a pass: a quick strike (ease-out) then a settle at the receiver,
// with a "hop" value (0 -> 1 -> 0) so the ball can loft like a real bouncing pass.
function ballAlongPath(path, t) {
  var segs  = path.length - 1;
  var f     = clamp(t, 0, 1) * segs;
  var i     = Math.min(Math.floor(f), segs - 1);               // current segment
  var local = f - i;                                           // 0 -> 1 within it

  var travel = 1 - CONFIG.passSettleFrac;                      // strike, then settle
  var u      = clamp(local / travel, 0, 1);                    // 0 -> 1 during the strike
  var e      = 1 - Math.pow(1 - u, 2);                         // ease-out: fast then slow

  return {
    x: lerp(path[i].x, path[i + 1].x, e),
    y: lerp(path[i].y, path[i + 1].y, e),
    hop: Math.sin(Math.PI * u),                                // lofts mid-pass, flat at the ends
    seg: i,
    arrived: u >= 1,                                           // reached this receiver
    done: t >= 1,
  };
}
// end of ballAlongPath()

// returns a team's live token positions: a small idle jitter so they look alive,
// plus an upfield drift over the match. The ball's route reads off these exact
// positions, so passes always land on a real player.
function livePositions(base, now, t, dyDrift) {
  var drift = easeInOut(clamp(t, 0, 1)) * dyDrift;             // whole line shifts over time
  var out = [];
  for (var i = 0; i < base.length; i++) {
    var jx = Math.sin(now / 280 + i * 1.7) * 3.5;              // small living jitter
    var jy = Math.cos(now / 330 + i * 2.3) * 3.5;
    out.push({ x: base[i].x + jx, y: base[i].y + drift + jy });
  }
  // end of for i loop
  return out;
}
// end of livePositions()

// ----------------------------------------------------------------
// CANVAS DRAWING HELPERS
// ----------------------------------------------------------------

// converts normalised layout positions into canvas pixel positions
function toPixels(layout, w, h) {
  var out = [];
  for (var i = 0; i < layout.length; i++) {
    out.push({ x: layout[i].x * w, y: layout[i].y * h });
  }
  // end of for i loop
  return out;
}
// end of toPixels()

// draws the top-down pitch markings
function drawPitch(ctx, w, h) {
  ctx.fillStyle = CONFIG.colors.pitchGreen;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = CONFIG.colors.lineColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;

  // outer boundary
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // halfway line and centre circle
  ctx.beginPath();
  ctx.moveTo(16, h / 2);
  ctx.lineTo(w - 16, h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2);
  ctx.stroke();

  // penalty boxes top (red end) and bottom (blue end)
  var boxW = w * 0.34;
  ctx.strokeRect((w - boxW) / 2, 16, boxW, 64);
  ctx.strokeRect((w - boxW) / 2, h - 16 - 64, boxW, 64);

  // -- goals: a frame just OUTSIDE each goal line, plus a few net strands --
  // width matches the corner shot spots (0.40w / 0.60w) so a corner finish lands
  // inside the net. top = opponent goal (you score here), bottom = your goal.
  var goalW     = w * 0.22;
  var goalDepth = 12;
  var gx1 = (w - goalW) / 2;
  var gx2 = (w + goalW) / 2;
  var topLine = 16;
  var botLine = h - 16;

  // the posts/crossbar frame — bright neon
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();                                              // top goal (opponent)
  ctx.moveTo(gx1, topLine);
  ctx.lineTo(gx1, topLine - goalDepth);
  ctx.lineTo(gx2, topLine - goalDepth);
  ctx.lineTo(gx2, topLine);
  ctx.stroke();
  ctx.beginPath();                                              // bottom goal (yours)
  ctx.moveTo(gx1, botLine);
  ctx.lineTo(gx1, botLine + goalDepth);
  ctx.lineTo(gx2, botLine + goalDepth);
  ctx.lineTo(gx2, botLine);
  ctx.stroke();

  // net strands — thin + dim, just for texture
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.32;
  var strands = 6;
  for (var g = 1; g < strands; g++) {
    var gx = gx1 + (goalW * g / strands);
    ctx.beginPath(); ctx.moveTo(gx, topLine); ctx.lineTo(gx, topLine - goalDepth); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, botLine); ctx.lineTo(gx, botLine + goalDepth); ctx.stroke();
  }
  // end of for g loop
  ctx.beginPath(); ctx.moveTo(gx1, topLine - goalDepth / 2); ctx.lineTo(gx2, topLine - goalDepth / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gx1, botLine + goalDepth / 2); ctx.lineTo(gx2, botLine + goalDepth / 2); ctx.stroke();

  ctx.globalAlpha = 1;
}
// end of drawPitch()

// draws one team's tokens at the positions livePositions already computed
function drawTeam(ctx, tokens, color) {
  for (var i = 0; i < tokens.length; i++) {
    ctx.beginPath();
    ctx.arc(tokens[i].x, tokens[i].y, 9, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(226,232,240,0.65)";                 // thin ink ring for contrast
    ctx.stroke();
  }
  // end of for i loop
}
// end of drawTeam()

// draws the ball as the football image (with a white-dot fallback): scales in at
// kickoff, lofts on each pass (with a ground shadow), and rolls as it travels
function drawBall(ctx, x, y, t, hop) {
  var dropFraction = CONFIG.simKickoffDropMs / CONFIG.simDurationMs;
  // when the ball was just dropped onto the pitch from the kickoff button, it's
  // already full-size — skip the scale-in so the hand-off reads as the same ball
  var dropScale = simInstantBall ? 1 : clamp(t / dropFraction, 0, 1);
  var loft = (hop || 0);                                        // 0 on the ground, 1 mid-pass
  var r = 6 * dropScale * (1 + loft * CONFIG.ballHopScale);     // grows as it rises
  var lift = loft * 6;                                          // visually rises off the turf
  var half = r * 1.25;                                          // football image, kept small

  // shadow stays on the ground while the ball lifts — sells the bounce
  ctx.beginPath();
  ctx.arc(x, y, half * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fill();

  // the football itself — the real image once loaded, else a white dot
  if (simBallReady) {
    ctx.save();
    ctx.translate(x, y - lift);
    ctx.rotate((x + y) * 0.05);                                 // rolls as it moves
    ctx.drawImage(simBallImg, -half, -half, half * 2, half * 2);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(x, y - lift, r, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.ballColor;
    ctx.fill();
  }
  // end of if-block
}
// end of drawBall()

// ----------------------------------------------------------------
// RESULT STATES
// ----------------------------------------------------------------

// shows the right result screen after the sim finishes
function showResult(didScore) {
  if (didScore) {
    showWellDone();                                             // goal -> success (button routes to the store)
    return;                                                     // nothing else to do
  }
  // end of if-block

  showTryAgain();                                               // miss -> retry, not punishment
}
// end of showResult()

// reveals the success overlay
function showWellDone() {
  lastResultWasGoal = true;

  var overlay = document.getElementById("result-overlay");
  var title   = document.getElementById("result-title");
  var msg     = document.getElementById("result-msg");
  var action  = document.getElementById("result-action");

  title.textContent = "Well Done";
  title.classList.remove("miss");
  msg.textContent   = "That counter cracked the 4-4-2. This is the real game.";
  action.textContent = "Get the game";
  action.classList.remove("retry");

  overlay.hidden = false;
}
// end of showWellDone()

// reveals the retry overlay — skill feedback, never punishment
function showTryAgain() {
  lastResultWasGoal = false;

  var overlay = document.getElementById("result-overlay");
  var title   = document.getElementById("result-title");
  var msg     = document.getElementById("result-msg");
  var action  = document.getElementById("result-action");

  title.textContent = "Try Again";
  title.classList.add("miss");
  msg.textContent   = "That lineup could be beaten — set a better one.";
  action.textContent = "Set a better lineup";
  action.classList.add("retry");

  overlay.hidden = false;
}
// end of showTryAgain()

// picks the right store for the user's device:
// iOS -> App Store, Android -> Play Store, anything else -> desktop fallback
function storeUrl() {
  var ua = navigator.userAgent || navigator.vendor || "";

  // iPadOS 13+ masquerades as a Mac, so also treat a touch "MacIntel" as iOS
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return CONFIG.storeLinks.ios;
  }
  // end of if-block

  if (/android/i.test(ua)) {
    return CONFIG.storeLinks.android;
  }
  // end of if-block

  return CONFIG.storeLinks.desktop;                             // laptop / desktop
}
// end of storeUrl()

// handles the overlay button: store on a win, picker on a miss
function onResultAction() {
  if (lastResultWasGoal) {
    window.location.href = storeUrl();                          // device-aware store link
    return;                                                     // done with the win path
  }
  // end of if-block

  resetToPicker();                                              // a miss: choose again
}
// end of onResultAction()

// hides the arena and returns Alex to the formation picker
function resetToPicker() {
  var arena   = document.getElementById("arena");
  var overlay = document.getElementById("result-overlay");
  var builder = document.getElementById("builder");

  overlay.hidden = true;
  arena.hidden   = true;
  builder.scrollIntoView({ behavior: "smooth", block: "start" });

  // the ball was handed to the pitch on kickoff — bring it back onto the
  // kickoff button so it's ready (bouncing) for another go
  var ball    = document.getElementById("builder-ball");
  var kickoff = document.getElementById("kickoff-btn");
  if (ball && kickoff && builderBallArmed && !prefersReducedMotion()) {
    handoffBuilderBallToIdle(builder, ball, kickoff);
  }
  // end of if-block
}
// end of resetToPicker()

// ----------------------------------------------------------------
// SMALL MATH HELPERS
// ----------------------------------------------------------------

// keeps a value inside the min..max range
function clamp(value, min, max) {
  if (value < min) { return min; } // below range
  // end of if-block
  if (value > max) { return max; } // above range
  // end of if-block
  return value;
}
// end of clamp()

// straight linear interpolation between a and b
function lerp(a, b, t) {
  return a + (b - a) * t;
}
// end of lerp()

// smooth ease so the ball does not start or stop abruptly
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
// end of easeInOut()

// formats elapsed milliseconds as a 0:0X match clock, capped at 10 seconds
function formatTime(ms) {
  var sec = Math.min(Math.floor(ms / 1000), 10);
  return "0:" + (sec < 10 ? "0" + sec : sec);
}
// end of formatTime()

// ----------------------------------------------------------------
// BOOT
// ----------------------------------------------------------------

// wires everything once the page is ready
function init() {
  watchHero();                                                  // arm the hero ball
  wireSoundToggle();                                            // arm the mute/unmute button
  wireBuilder();                                                // arm the formation cards

  var cta = document.getElementById("cta");
  if (cta) {
    cta.addEventListener("click", function (e) {
      // reduced motion: let the native anchor jump to #builder happen
      if (prefersReducedMotion()) {
        return;                                                 // no coordinated move
      }
      // end of if-block
      e.preventDefault();                                       // we drive scroll + ball together
      startBuilderBall();
    });
  }
  // end of if-block

  var action = document.getElementById("result-action");
  if (action) {
    action.addEventListener("click", onResultAction);           // overlay button
  }
  // end of if-block
}
// end of init()

// always open at the top: don't let the browser restore the last scroll position
// or jump to a leftover "#builder" hash when the page is reloaded
if ("scrollRestoration" in history) { history.scrollRestoration = "manual"; }
window.addEventListener("load", function () {
  if (location.hash) {                                          // clear a leftover hash
    history.replaceState(null, "", location.pathname + location.search);
  }
  // end of if-block
  window.scrollTo(0, 0);
});

document.addEventListener("DOMContentLoaded", init);
