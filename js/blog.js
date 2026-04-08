document.addEventListener('DOMContentLoaded', () => {
  const backpack = document.getElementById('backpack');
  const questTitle = document.getElementById('quest-title');
  const questHeading = document.getElementById('quest-heading');
  const questStatus = document.getElementById('quest-status');
  const questDate = document.getElementById('quest-date');
  const questText = document.getElementById('quest-text');
  const questBox = document.getElementById('quest-box');
  const readQuestBtn = document.getElementById('read-quest');
  const questOverlay = document.getElementById('quest-overlay');
  const questModalTitle = document.getElementById('quest-modal-title');
  const questMarkdown = document.getElementById('quest-markdown');
  const completeQuestBtn = document.getElementById('complete-quest');
  const cancelQuestBtn = document.getElementById('cancel-quest');
  const experienceLevel = document.getElementById('experience-level');
  const experienceBarFill = document.getElementById('experience-bar-fill');
  const experienceText = document.getElementById('experience-text');
  const logoutButton = document.querySelector('.logout-button');
  const murlocSurprise = document.getElementById('murloc-surprise');

  const embeddedMarkdown = globalThis.POST_MARKDOWN || {};
  const markdownCache = new Map();
  const progressStorageKey = 'warcraft-blog-progress';
  const experiencePerQuest = 100;
  const experiencePerLevel = 300;
  const soundPaths = {
    open: 'sounds/open.ogg',
    complete: 'sounds/complete.ogg',
    exit: 'sounds/exit.ogg',
    select: 'sounds/select.ogg',
    murloc: 'sounds/murloc.ogg',
    levelup: 'sounds/levelup.ogg',
  };
  const soundEffects = Object.fromEntries(
    Object.entries(soundPaths).map(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      return [key, audio];
    })
  );
  const postDefinitions = [
    {
      id: 'deadmines',
      title: 'Deadmines',
      image: 'assets/deadmines.png',
      postedDate: '8th of April - 2026',
      summary:
        'At level 18, we ventured into the shadowy mines of Westfall to face the Defias Brotherhood. Treacherous paths, goblin miners, and the fearsome Captain Cookie awaited us. It was an adventure filled with danger and loot.',
    },
    {
      id: 'mount',
      title: 'Mount',
      image: 'assets/mount.png',
      postedDate: '8th of April - 2026',
      summary:
        'Getting a first mount always feels like the world suddenly opens up. This journal entry follows the gold grind, the level push, and the relief of finally riding across Azeroth at a proper pace.',
    },
    {
      id: 'gnomeregan',
      title: 'Gnomeregan',
      image: 'assets/gnomeregan.png',
      postedDate: '8th of April - 2026',
      summary:
        'Gnomeregan is all sparks, tunnels, and chaos. I wrote this one as a field report on the city\'s broken machinery, the long pulls, and the strange charm of one of Classic\'s messiest dungeons.',
    },
    {
      id: 'whirlwindaxe',
      title: 'Whirlwind Axe',
      image: 'assets/whirlwindaxe.png',
      postedDate: '8th of April - 2026',
      summary:
        'The Whirlwind Axe quest chain feels like a true warrior trial. This story covers the preparation, the level disadvantage, and why earning that weapon still feels more memorable than most upgrades.',
    },
    {
      id: 'scarlet',
      title: 'Scarlet Monastery',
      image: 'assets/scarlet_monastery.png',
      postedDate: '8th of April - 2026',
      summary:
        'This chapter is still being written. The Scarlet Monastery run is coming soon, with cathedral pulls, loot highlights, and a few stories that deserve their own parchment.',
    },
    {
      id: 'flyingmounts',
      title: 'Flying Mounts',
      image: 'assets/flying_mounts.png',
      postedDate: '8th of April - 2026',
      summary:
        'Flying mounts are not ready for this journal yet. Once the tale lands, it will cover the long wait, the cost, and the first view from above the world.',
    },
  ];

  let activePost = null;
  let activeSlot = null;
  let openQuestPostId = null;
  let clickTimestamps = [];
  let murlocHideTimer = null;
  let slotElements = new Map();
  let completedPostIds = new Set();
  let posts = [];

  readQuestBtn.disabled = true;
  readQuestBtn.setAttribute('aria-disabled', 'true');

  function getMarkdownPath(id) {
    return `posts/${id}.md`;
  }

  function loadProgress() {
    try {
      const rawProgress = window.localStorage.getItem(progressStorageKey);

      if (!rawProgress) {
        return new Set();
      }

      const parsedProgress = JSON.parse(rawProgress);
      const ids = Array.isArray(parsedProgress.completedPostIds) ? parsedProgress.completedPostIds : [];
      const knownPostIds = new Set(postDefinitions.map(({ id }) => id));

      return new Set(ids.filter((id) => typeof id === 'string' && knownPostIds.has(id)));
    } catch (error) {
      return new Set();
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(
        progressStorageKey,
        JSON.stringify({
          completedPostIds: [...completedPostIds],
        })
      );
    } catch (error) {
      // Ignore storage failures so the page remains usable.
    }
  }

  function getExperienceProgress() {
    const totalExperience = completedPostIds.size * experiencePerQuest;
    const level = Math.floor(totalExperience / experiencePerLevel) + 1;
    const currentLevelExperience = totalExperience % experiencePerLevel;

    return {
      totalExperience,
      level,
      currentLevelExperience,
      nextLevelExperience: experiencePerLevel,
    };
  }

  function updateExperienceDisplay() {
    const progress = getExperienceProgress();
    const fillPercentage = (progress.currentLevelExperience / progress.nextLevelExperience) * 100;

    if (experienceLevel) {
      experienceLevel.textContent = String(progress.level);
    }

    if (experienceBarFill) {
      experienceBarFill.style.width = `${fillPercentage}%`;
    }

    if (experienceText) {
      experienceText.textContent = `${progress.currentLevelExperience} / ${progress.nextLevelExperience} XP`;
    }
  }

  function playSound(name) {
    const audio = soundEffects[name];

    if (!audio) {
      return;
    }

    try {
      audio.pause();
      audio.currentTime = 0;

      const playPromise = audio.play();

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (error) {
      // Ignore audio playback failures so the UI keeps working.
    }
  }

  function syncSlotQuestMarker(slot, post) {
    const existingMarker = slot.querySelector('.slot-quest-marker');

    if (existingMarker) {
      existingMarker.remove();
    }

    if (!post.available || completedPostIds.has(post.id)) {
      return;
    }

    const marker = document.createElement('img');
    marker.className = 'slot-quest-marker';
    marker.src = 'assets/quest_icon.png';
    marker.alt = '';
    marker.setAttribute('aria-hidden', 'true');
    slot.appendChild(marker);
  }

  function markPostCompleted(postId) {
    if (completedPostIds.has(postId)) {
      return false;
    }

    const previousProgress = getExperienceProgress();

    completedPostIds.add(postId);
    saveProgress();
    updateExperienceDisplay();

    const slot = slotElements.get(postId);
    const post = posts.find((entry) => entry.id === postId);

    if (slot && post) {
      syncSlotQuestMarker(slot, post);
    }

    return getExperienceProgress().level > previousProgress.level;
  }

  function showMurlocSurprise() {
    if (!murlocSurprise) {
      return;
    }

    playSound('murloc');
    murlocSurprise.classList.add('is-visible');
    murlocSurprise.setAttribute('aria-hidden', 'false');

    if (murlocHideTimer) {
      window.clearTimeout(murlocHideTimer);
    }

    murlocHideTimer = window.setTimeout(() => {
      murlocSurprise.classList.remove('is-visible');
      murlocSurprise.setAttribute('aria-hidden', 'true');
      murlocHideTimer = null;
    }, 2500);
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseInlineMarkdown(text) {
    let html = escapeHtml(text);

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return html;
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let listType = null;
    let blockquote = [];
    let codeFence = [];
    let inCodeFence = false;

    function flushParagraph() {
      if (!paragraph.length) {
        return;
      }

      html.push(`<p>${parseInlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!listType) {
        return;
      }

      html.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    }

    function flushBlockquote() {
      if (!blockquote.length) {
        return;
      }

      html.push(`<blockquote><p>${parseInlineMarkdown(blockquote.join(' '))}</p></blockquote>`);
      blockquote = [];
    }

    function flushCodeFence() {
      if (!codeFence.length) {
        return;
      }

      html.push(`<pre><code>${escapeHtml(codeFence.join('\n'))}</code></pre>`);
      codeFence = [];
    }

    lines.forEach((line) => {
      const trimmed = line.trim();
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      const orderedListMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      const unorderedListMatch = trimmed.match(/^[-*]\s+(.*)$/);
      const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);

      if (trimmed.startsWith('```')) {
        flushParagraph();
        flushList();
        flushBlockquote();

        if (inCodeFence) {
          flushCodeFence();
          inCodeFence = false;
        } else {
          inCodeFence = true;
        }

        return;
      }

      if (inCodeFence) {
        codeFence.push(line);
        return;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        flushBlockquote();
        return;
      }

      if (headingMatch) {
        flushParagraph();
        flushList();
        flushBlockquote();
        html.push(
          `<h${headingMatch[1].length}>${parseInlineMarkdown(headingMatch[2])}</h${headingMatch[1].length}>`
        );
        return;
      }

      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        flushParagraph();
        flushList();
        flushBlockquote();
        html.push('<hr />');
        return;
      }

      if (blockquoteMatch) {
        flushParagraph();
        flushList();
        blockquote.push(blockquoteMatch[1]);
        return;
      }

      if (unorderedListMatch) {
        flushParagraph();
        flushBlockquote();

        if (listType !== 'ul') {
          flushList();
          html.push('<ul>');
          listType = 'ul';
        }

        html.push(`<li>${parseInlineMarkdown(unorderedListMatch[1])}</li>`);
        return;
      }

      if (orderedListMatch) {
        flushParagraph();
        flushBlockquote();

        if (listType !== 'ol') {
          flushList();
          html.push('<ol>');
          listType = 'ol';
        }

        html.push(`<li>${parseInlineMarkdown(orderedListMatch[1])}</li>`);
        return;
      }

      flushList();
      flushBlockquote();
      paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();
    flushBlockquote();
    flushCodeFence();

    return html.join('');
  }

  function getMarkdownPresentation(markdown, fallbackTitle) {
    const normalized = markdown.replace(/\r\n?/g, '\n').trim();
    const titleMatch = normalized.match(/^#\s+(.+?)\n+/);

    if (!titleMatch) {
      return {
        title: fallbackTitle,
        html: renderMarkdown(normalized),
      };
    }

    return {
      title: titleMatch[1].trim(),
      html: renderMarkdown(normalized.slice(titleMatch[0].length)),
    };
  }

  async function resolvePost(post) {
    const markdownPath = getMarkdownPath(post.id);
    const cachedMarkdown = embeddedMarkdown[post.id];

    if (typeof cachedMarkdown === 'string' && cachedMarkdown.trim()) {
      markdownCache.set(post.id, cachedMarkdown);

      return {
        ...post,
        available: true,
        markdownPath,
      };
    }

    if (window.location.protocol === 'file:') {
      return {
        ...post,
        available: false,
        markdownPath,
      };
    }

    try {
      const response = await fetch(markdownPath);

      if (!response.ok) {
        return {
          ...post,
          available: false,
          markdownPath,
        };
      }

      const markdown = await response.text();

      if (!markdown.trim()) {
        return {
          ...post,
          available: false,
          markdownPath,
        };
      }

      markdownCache.set(post.id, markdown);

      return {
        ...post,
        available: true,
        markdownPath,
      };
    } catch (error) {
      return {
        ...post,
        available: false,
        markdownPath,
      };
    }
  }

  function setActivePost(post, slot) {
    activePost = post;
    questTitle.textContent = post.title;
    questHeading.textContent = `The ${post.title}`;
    questStatus.textContent = post.available ? 'Quest Summary' : 'Coming Soon';
    questDate.textContent = post.postedDate || '';
    questText.textContent = post.summary || 'This story summary has not been written yet.';
    questBox.classList.toggle('is-coming-soon', !post.available);
    readQuestBtn.disabled = !post.available;
    readQuestBtn.setAttribute('aria-disabled', String(!post.available));

    if (activeSlot) {
      activeSlot.classList.remove('is-active');
    }

    if (slot) {
      slot.classList.add('is-active');
      activeSlot = slot;
    }
  }

  function closeQuestOverlay() {
    openQuestPostId = null;
    questOverlay.classList.add('hidden');
    questOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
  }

  function openQuestOverlay(post) {
    const markdown = markdownCache.get(post.id);

    if (!markdown) {
      return;
    }

    const presentation = getMarkdownPresentation(markdown, post.title);

    questModalTitle.textContent = presentation.title;
    questMarkdown.innerHTML = presentation.html;
    openQuestPostId = post.id;
    questOverlay.classList.remove('hidden');
    questOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
  }

  function createSlot(post) {
    const slot = document.createElement('button');
    slot.className = 'slot';
    slot.type = 'button';

    if (!post.available) {
      slot.classList.add('coming-soon');
    }

    const img = document.createElement('img');
    img.className = 'slot-art';
    img.src = post.image;
    img.alt = post.title;
    slot.appendChild(img);

    const title = document.createElement('span');
    title.className = 'slot-title';
    title.textContent = post.title;
    slot.appendChild(title);

    if (!post.available) {
      const status = document.createElement('span');
      status.className = 'coming-label';
      status.textContent = 'Coming Soon';
      slot.appendChild(status);
    }

    syncSlotQuestMarker(slot, post);

    slot.addEventListener('click', () => {
      playSound('select');
      setActivePost(post, slot);
    });

    return slot;
  }

  async function initializeBlog() {
    completedPostIds = loadProgress();
    posts = await Promise.all(postDefinitions.map((post) => resolvePost(post)));
    slotElements = new Map();
    updateExperienceDisplay();

    posts.forEach((post, index) => {
      const slot = createSlot(post);
      slotElements.set(post.id, slot);
      backpack.appendChild(slot);

      if (index === 0) {
        setActivePost(post, slot);
      }
    });
  }

  readQuestBtn.addEventListener('click', () => {
    if (!activePost || !activePost.available) {
      return;
    }

    playSound('open');
    openQuestOverlay(activePost);
  });

  completeQuestBtn.addEventListener('click', () => {
    let leveledUp = false;

    if (openQuestPostId) {
      leveledUp = markPostCompleted(openQuestPostId);
    }

    playSound('complete');

    if (leveledUp) {
      window.setTimeout(() => {
        playSound('levelup');
      }, 180);
    }

    closeQuestOverlay();
  });

  cancelQuestBtn.addEventListener('click', () => {
    playSound('exit');
    closeQuestOverlay();
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', (event) => {
      const href = logoutButton.getAttribute('href');

      if (!href) {
        return;
      }

      event.preventDefault();
      playSound('exit');
      window.setTimeout(() => {
        window.location.href = href;
      }, 180);
    });
  }

  questOverlay.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeQuest === 'true') {
      playSound('exit');
      closeQuestOverlay();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !questOverlay.classList.contains('hidden')) {
      playSound('exit');
      closeQuestOverlay();
    }
  });

  document.addEventListener('click', () => {
    const now = window.performance.now();

    clickTimestamps.push(now);
    clickTimestamps = clickTimestamps.filter((timestamp) => now - timestamp <= 1000);

    if (clickTimestamps.length >= 3) {
      clickTimestamps = [];
      showMurlocSurprise();
    }
  });

  initializeBlog();
});
