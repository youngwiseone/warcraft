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

  const markdownCache = new Map();
  const isFileProtocol = window.location.protocol === 'file:';
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
  const postManifest = Array.isArray(window.POST_MANIFEST)
    ? window.POST_MANIFEST.filter((id) => typeof id === 'string' && id.trim())
    : [];

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

  function titleFromId(id) {
    return id
      .split(/[_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function getImagePath(id, extension = 'png') {
    return `assets/${id}.${extension}`;
  }

  function getMarkdownPath(id) {
    return `posts/${id}.md`;
  }

  function getPostDefinitions() {
    return postManifest.map((id) => ({
      id,
      title: titleFromId(id),
      image: getImagePath(id),
      fallbackImage: getImagePath(id, 'jpg'),
    }));
  }

  function loadProgress() {
    try {
      const rawProgress = window.localStorage.getItem(progressStorageKey);

      if (!rawProgress) {
        return new Set();
      }

      const parsedProgress = JSON.parse(rawProgress);
      const ids = Array.isArray(parsedProgress.completedPostIds) ? parsedProgress.completedPostIds : [];

      return new Set(ids.filter((id) => typeof id === 'string'));
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

  function extractMarkdownMetadata(markdown) {
    const normalized = markdown.replace(/\r\n?/g, '\n');
    const metadata = {};
    let content = normalized;

    while (true) {
      const metadataMatch = content.match(
        /^\s*<!--\s*([a-z][a-z0-9_-]*)\s*:\s*(.*?)\s*-->\s*\n*/i
      );

      if (!metadataMatch) {
        break;
      }

      metadata[metadataMatch[1].toLowerCase()] = metadataMatch[2].trim();
      content = content.slice(metadataMatch[0].length);
    }

    const postedIso = metadata.posted || '';
    const postedTimestamp = postedIso ? Date.parse(`${postedIso}T00:00:00Z`) : Number.NaN;
    const status = (metadata.status || '').toLowerCase();

    return {
      markdown: content,
      status,
      postedIso,
      postedTimestamp,
    };
  }

  function formatPostedDate(postedIso) {
    if (!postedIso) {
      return '';
    }

    const postedDate = new Date(`${postedIso}T00:00:00Z`);

    if (Number.isNaN(postedDate.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(postedDate);
  }

  function parseInlineMarkdown(text) {
    let html = escapeHtml(text);

    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy" />'
    );
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return html;
  }

  function getYouTubeEmbedUrl(url) {
    try {
      const parsedUrl = new URL(url, window.location.href);
      const hostname = parsedUrl.hostname.replace(/^www\./, '');
      let videoId = '';

      if (hostname === 'youtu.be') {
        videoId = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
      } else if (
        hostname === 'youtube.com' ||
        hostname === 'm.youtube.com' ||
        hostname === 'music.youtube.com' ||
        hostname === 'youtube-nocookie.com'
      ) {
        if (parsedUrl.pathname === '/watch') {
          videoId = parsedUrl.searchParams.get('v') || '';
        } else if (parsedUrl.pathname.startsWith('/shorts/')) {
          videoId = parsedUrl.pathname.split('/')[2] || '';
        } else if (parsedUrl.pathname.startsWith('/embed/')) {
          videoId = parsedUrl.pathname.split('/')[2] || '';
        }
      }

      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        return null;
      }

      return `https://www.youtube-nocookie.com/embed/${videoId}`;
    } catch (error) {
      return null;
    }
  }

  function getMediaEmbedHtml(text) {
    const explicitYouTubeMatch = text.match(/^!youtube\((.+)\)$/i);
    const candidate = explicitYouTubeMatch ? explicitYouTubeMatch[1].trim() : text;
    const youtubeEmbedUrl = getYouTubeEmbedUrl(candidate);

    if (!youtubeEmbedUrl) {
      return null;
    }

    return `
      <div class="quest-video">
        <iframe
          src="${youtubeEmbedUrl}"
          title="YouTube video player"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>
    `;
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
      const mediaEmbedHtml = getMediaEmbedHtml(trimmed);

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

      if (mediaEmbedHtml) {
        flushParagraph();
        flushList();
        flushBlockquote();
        html.push(mediaEmbedHtml);
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

  function stripMarkdownForPreview(markdown) {
    return markdown
      .replace(/\r\n?/g, '\n')
      .replace(/^>\s?/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^!youtube\((.+)\)$/gim, '')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^(-{3,}|\*{3,})$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getMarkdownPresentation(markdown) {
    const normalized = markdown.replace(/\r\n?/g, '\n').trim();
    const titleMatch = normalized.match(/^#\s+.+?\n+/);
    const content = titleMatch ? normalized.slice(titleMatch[0].length).trim() : normalized;
    const contentLines = content.split('\n');
    const summarySeparatorIndex = contentLines.findIndex((line) => /^(-{3,}|\*{3,})$/.test(line.trim()));
    const summaryMarkdown =
      summarySeparatorIndex >= 0
        ? contentLines.slice(0, summarySeparatorIndex).join('\n').trim()
        : content;

    return {
      html: renderMarkdown(content),
      summary: stripMarkdownForPreview(summaryMarkdown),
    };
  }

  async function resolvePost(post) {
    const markdownPath = getMarkdownPath(post.id);
    if (isFileProtocol) {
      return {
        ...post,
        available: false,
        markdownPath,
        statusLabel: 'Local Server Required',
        unavailableSummary:
          'Open the site through a local web server to load posts/*.md directly.',
      };
    }

    try {
      const response = await fetch(markdownPath);

      if (!response.ok) {
        return {
          ...post,
          available: false,
          markdownPath,
          statusLabel: 'Missing Post',
        };
      }

      const markdown = await response.text();

      if (!markdown.trim()) {
        return {
          ...post,
          available: false,
          markdownPath,
          statusLabel: 'Empty Post',
        };
      }

      markdownCache.set(post.id, markdown);

      const metadata = extractMarkdownMetadata(markdown);
      const presentation = getMarkdownPresentation(metadata.markdown);
      const isPlanned = metadata.status === 'planned';

      return {
        ...post,
        available: !isPlanned,
        markdownPath,
        summary: presentation.summary || post.summary,
        postedDate: formatPostedDate(metadata.postedIso),
        sortDate: Number.isNaN(metadata.postedTimestamp) ? Number.POSITIVE_INFINITY : metadata.postedTimestamp,
        statusLabel: isPlanned ? 'Coming Soon' : post.statusLabel,
        unavailableSummary: isPlanned
          ? presentation.summary || 'This post is planned but not readable yet.'
          : post.unavailableSummary,
      };
    } catch (error) {
      return {
        ...post,
        available: false,
        markdownPath,
        statusLabel: 'Load Failed',
      };
    }
  }

  function setActivePost(post, slot) {
    activePost = post;
    questTitle.textContent = post.title;
    questHeading.textContent = post.title;
    questStatus.textContent = post.available ? 'Quest Summary' : post.statusLabel || 'Unavailable';
    questDate.textContent = post.postedDate || '';
    questText.textContent =
      post.available
        ? post.summary || 'This story summary has not been written yet.'
        : post.unavailableSummary || post.summary || 'This post could not be loaded.';
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

    const metadata = extractMarkdownMetadata(markdown);
    const presentation = getMarkdownPresentation(metadata.markdown);

    questModalTitle.textContent = post.title;
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
    img.addEventListener(
      'error',
      () => {
        if (post.fallbackImage && img.src !== new URL(post.fallbackImage, window.location.href).href) {
          img.src = post.fallbackImage;
        }
      },
      { once: true }
    );
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
      status.textContent = post.statusLabel || 'Unavailable';
      slot.appendChild(status);
    }

    syncSlotQuestMarker(slot, post);

    slot.addEventListener('click', () => {
      playSound('select');
      setActivePost(post, slot);
    });

    return slot;
  }

  function comparePosts(a, b) {
    const aSortDate = Number.isFinite(a.sortDate) ? a.sortDate : Number.POSITIVE_INFINITY;
    const bSortDate = Number.isFinite(b.sortDate) ? b.sortDate : Number.POSITIVE_INFINITY;

    if (aSortDate !== bSortDate) {
      return aSortDate - bSortDate;
    }

    return a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });
  }

  async function initializeBlog() {
    completedPostIds = loadProgress();
    posts = await Promise.all(getPostDefinitions().map((post) => resolvePost(post)));
    posts.sort(comparePosts);
    completedPostIds = new Set(
      [...completedPostIds].filter((postId) => posts.some((post) => post.id === postId))
    );
    saveProgress();
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
