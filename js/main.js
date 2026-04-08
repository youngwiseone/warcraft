document.addEventListener('DOMContentLoaded', () => {
  const enterButton = document.getElementById('enter-button');
  const loginVideo = document.getElementById('login-video');
  const videoAudioToggle = document.getElementById('video-audio-toggle');
  const loginSound = new Audio('sounds/login.ogg');
  const videoAudioPreferenceKey = 'warcraft-video-audio-enabled';

  loginSound.preload = 'auto';

  function updateVideoAudioButton(enabled) {
    if (!videoAudioToggle) {
      return;
    }

    videoAudioToggle.textContent = enabled ? 'Video Sound: On' : 'Video Sound: Off';
    videoAudioToggle.setAttribute('aria-pressed', String(enabled));
  }

  function persistVideoAudioPreference(enabled) {
    try {
      window.localStorage.setItem(videoAudioPreferenceKey, JSON.stringify(enabled));
    } catch (error) {
      // Ignore storage failures and keep the current session behavior.
    }
  }

  function readVideoAudioPreference() {
    try {
      return window.localStorage.getItem(videoAudioPreferenceKey) === 'true';
    } catch (error) {
      return false;
    }
  }

  function applyVideoAudioPreference(enabled) {
    if (!loginVideo) {
      updateVideoAudioButton(enabled);
      return;
    }

    loginVideo.muted = !enabled;
    loginVideo.volume = enabled ? 1 : 0;
    updateVideoAudioButton(enabled);

    const playPromise = loginVideo.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        loginVideo.muted = true;
        loginVideo.volume = 0;
        updateVideoAudioButton(false);
      });
    }
  }

  const initialVideoAudioEnabled = readVideoAudioPreference();

  applyVideoAudioPreference(initialVideoAudioEnabled);

  if (videoAudioToggle) {
    videoAudioToggle.addEventListener('click', () => {
      const nextEnabled = !(loginVideo && !loginVideo.muted);

      persistVideoAudioPreference(nextEnabled);
      applyVideoAudioPreference(nextEnabled);
    });
  }

  if (enterButton) {
    enterButton.addEventListener('click', () => {
      try {
        loginSound.pause();
        loginSound.currentTime = 0;

        const playPromise = loginSound.play();

        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch (error) {
        // Ignore playback errors so login still works.
      }

      window.setTimeout(() => {
        window.location.href = 'blog.html';
      }, 180);
    });
  }
});
