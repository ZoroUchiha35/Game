// Simple Pong game
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const leftScoreEl = document.getElementById('leftScore');
  const rightScoreEl = document.getElementById('rightScore');

  // Game settings
  const WINNING_SCORE = 10;

  // Canvas size (fixed in HTML but we keep local copies)
  let WIDTH = canvas.width;
  let HEIGHT = canvas.height;

  // Paddle
  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = 100;
  const PADDLE_SPEED = 420; // px per second for keyboard
  const AI_SPEED = 320; // px per second max speed (computer)

  // Ball
  const BALL_RADIUS = 8;
  const BALL_INITIAL_SPEED = 300; // px per second
  const BALL_SPEED_INCREASE = 1.05; // multiply speed on paddle hit
  const MAX_DEFLECTION_ANGLE = Math.PI / 3; // ~60 degrees

  // Game state
  let leftScore = 0;
  let rightScore = 0;
  let running = true;
  let lastTime = performance.now();
  let paused = false;

  // Entities
  const leftPaddle = {
    x: 20,
    y: (HEIGHT - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    dy: 0, // for keyboard
  };

  const rightPaddle = {
    x: WIDTH - 20 - PADDLE_WIDTH,
    y: (HEIGHT - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  };

  const ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
  };

  // Input
  let keyUp = false;
  let keyDown = false;
  let mouseActive = false;

  // Helpers
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function resetBall(servingTo = null) {
    ball.x = WIDTH / 2;
    ball.y = HEIGHT / 2;
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI; // small random angle
    const dir = servingTo === 'left' ? -1 : servingTo === 'right' ? 1 : (Math.random() < 0.5 ? -1 : 1);
    ball.vx = dir * BALL_INITIAL_SPEED * Math.cos(angle);
    ball.vy = BALL_INITIAL_SPEED * Math.sin(angle);
  }

  function resizeCanvasIfNeeded() {
    // If you want responsive canvas, implement here. For now we keep fixed size from HTML.
    WIDTH = canvas.width;
    HEIGHT = canvas.height;
    // Make sure paddles remain inside bounds after resize
    leftPaddle.y = clamp(leftPaddle.y, 0, HEIGHT - leftPaddle.height);
    rightPaddle.y = clamp(rightPaddle.y, 0, HEIGHT - rightPaddle.height);
  }

  function startNewRound(servingTo) {
    resetBall(servingTo);
    // small delay before resuming
    paused = true;
    setTimeout(() => { paused = false; }, 600);
  }

  // Collision detection between circle and rect
  function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
    // Find nearest point on rectangle to circle center
    const nearestX = clamp(cx, rx, rx + rw);
    const nearestY = clamp(cy, ry, ry + rh);
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx * dx + dy * dy) <= (r * r);
  }

  // Update
  function update(dt) {
    if (paused) return;

    // Left paddle keyboard movement
    leftPaddle.dy = 0;
    if (keyUp) leftPaddle.dy = -PADDLE_SPEED;
    if (keyDown) leftPaddle.dy = PADDLE_SPEED;

    // Apply keyboard movement
    leftPaddle.y += leftPaddle.dy * dt;

    // Mouse movement is handled directly in the mousemove handler (sets absolute y),
    // but ensure paddle stays inside
    leftPaddle.y = clamp(leftPaddle.y, 0, HEIGHT - leftPaddle.height);

    // Simple AI: move towards the ball's y position center with limited speed
    const targetY = ball.y - rightPaddle.height / 2;
    const diff = targetY - rightPaddle.y;
    const maxMove = AI_SPEED * dt;
    if (Math.abs(diff) > maxMove) {
      rightPaddle.y += Math.sign(diff) * maxMove;
    } else {
      rightPaddle.y = targetY;
    }
    rightPaddle.y = clamp(rightPaddle.y, 0, HEIGHT - rightPaddle.height);

    // Move ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Top/bottom wall collision
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = -ball.vy;
    } else if (ball.y + ball.radius >= HEIGHT) {
      ball.y = HEIGHT - ball.radius;
      ball.vy = -ball.vy;
    }

    // Left paddle collision
    if (ball.vx < 0 && circleRectCollision(ball.x, ball.y, ball.radius, leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height)) {
      // compute deflection based on where it hits the paddle
      const relativeIntersectY = (leftPaddle.y + leftPaddle.height / 2) - ball.y;
      const normalized = relativeIntersectY / (leftPaddle.height / 2); // -1..1
      const bounceAngle = normalized * MAX_DEFLECTION_ANGLE;
      const speed = Math.hypot(ball.vx, ball.vy) * BALL_SPEED_INCREASE;
      ball.vx = Math.abs(Math.cos(bounceAngle) * speed);
      ball.vy = -Math.sin(bounceAngle) * speed;
      // nudge ball out of paddle
      ball.x = leftPaddle.x + leftPaddle.width + ball.radius + 0.5;
    }

    // Right paddle collision
    if (ball.vx > 0 && circleRectCollision(ball.x, ball.y, ball.radius, rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height)) {
      const relativeIntersectY = (rightPaddle.y + rightPaddle.height / 2) - ball.y;
      const normalized = relativeIntersectY / (rightPaddle.height / 2);
      const bounceAngle = normalized * MAX_DEFLECTION_ANGLE;
      const speed = Math.hypot(ball.vx, ball.vy) * BALL_SPEED_INCREASE;
      ball.vx = -Math.abs(Math.cos(bounceAngle) * speed);
      ball.vy = -Math.sin(bounceAngle) * speed;
      ball.x = rightPaddle.x - ball.radius - 0.5;
    }

    // Score check
    if (ball.x + ball.radius < 0) {
      // Right player scores
      rightScore++;
      rightScoreEl.textContent = rightScore;
      if (rightScore >= WINNING_SCORE) {
        endGame('Computer wins!');
        return;
      }
      startNewRound('right');
    } else if (ball.x - ball.radius > WIDTH) {
      // Left player scores
      leftScore++;
      leftScoreEl.textContent = leftScore;
      if (leftScore >= WINNING_SCORE) {
        endGame('You win!');
        return;
      }
      startNewRound('left');
    }
  }

  function endGame(message) {
    paused = true;
    running = false;
    setTimeout(() => {
      alert(message + ' Refresh page to restart.');
    }, 50);
  }

  // Draw
  function draw() {
    // clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // middle dashed line
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.restore();

    // paddles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
    ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);

    // ball
    ctx.beginPath();
    ctx.fillStyle = '#ffd166';
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // small speed indicator (optional)
    //ctx.fillStyle = '#9aa6b2';
    //ctx.font = '12px sans-serif';
    //ctx.fillText(`Speed: ${Math.hypot(ball.vx, ball.vy).toFixed(0)}`, 10, HEIGHT - 10);
  }

  // Game loop
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033); // cap dt for stability
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Input handlers
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    leftPaddle.y = clamp(y - leftPaddle.height / 2, 0, HEIGHT - leftPaddle.height);
    mouseActive = true;
  });

  // Ensure canvas receives keyboard events
  canvas.addEventListener('mouseenter', () => canvas.focus());
  canvas.addEventListener('click', () => canvas.focus());

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp') {
      keyUp = true;
      e.preventDefault();
    } else if (e.code === 'ArrowDown') {
      keyDown = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      // pause/unpause
      paused = !paused;
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp') keyUp = false;
    if (e.code === 'ArrowDown') keyDown = false;
  });

  // Initialize
  function init() {
    resizeCanvasIfNeeded();
    leftScore = 0;
    rightScore = 0;
    leftScoreEl.textContent = leftScore;
    rightScoreEl.textContent = rightScore;
    resetBall();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // Start
  init();

  // Expose a small API for debugging if needed
  window.pong = {
    reset: () => { leftScore = rightScore = 0; leftScoreEl.textContent = 0; rightScoreEl.textContent = 0; resetBall(); paused = false; running = true; },
  };
})();