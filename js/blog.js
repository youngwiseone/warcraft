/*
 * blog.js
 *
 * This script populates the backpack interface on the blog page with blog
 * entries. Each entry appears as an item in a faux inventory grid. Clicking
 * available entries opens a quest-like panel displaying the post title and
 * content. Coming soon items are visually muted and cannot be interacted
 * with.
 */

document.addEventListener('DOMContentLoaded', () => {
  const backpack = document.getElementById('backpack');
  const questBox = document.getElementById('quest-box');
  const questTitle = document.getElementById('quest-title');
  const questText = document.getElementById('quest-text');
  const closeQuestBtn = document.getElementById('close-quest');

  // Define your blog posts. The description fields can be replaced with real
  // content once you write your posts. Available entries are clickable.
  const posts = [
    {
      id: 'deadmines',
      title: 'Deadmines',
      image: 'assets/deadmines.png',
      description:
        'Join me as I delve into the classic Deadmines dungeon. I’ll share tips for clearing it efficiently, my favorite loot, and memories from my first run.',
      available: true,
    },
    {
      id: 'mount',
      title: 'Mount',
      image: 'assets/mount.png',
      description:
        'Getting your first mount is a rite of passage. In this entry I recount my journey to level 40, how I farmed the gold and the joy of finally riding through Azeroth.',
      available: true,
    },
    {
      id: 'gnomeregan',
      title: 'Gnomeregan',
      image: 'assets/gnomeregan.png',
      description:
        'Exploring Gnomeregan’s mechanical depths was an unforgettable experience. Discover the quirks of this gnomish city and how to survive its hazards.',
      available: true,
    },
    {
      id: 'whirlwindaxe',
      title: 'Whirlwind Axe',
      image: 'assets/whirlwindaxe.png',
      description:
        'The Whirlwind Axe is a warrior’s badge of honor. Here I outline the quest chain, strategies to complete it at lower levels and why this weapon is so iconic.',
      available: true,
    },
    {
      id: 'scarlet',
      title: 'Scarlet Monastery',
      image: 'assets/scarlet_monastery.png',
      description: 'This post is coming soon. Stay tuned for tales from the Scarlet Monastery!',
      available: false,
    },
    {
      id: 'flyingmounts',
      title: 'Flying Mounts',
      image: 'assets/flying_mounts.png',
      description: 'This post is coming soon. I can’t wait to take to the skies on a flying mount!',
      available: false,
    },
  ];

  // Helper function to create a slot element
  function createSlot(post) {
    const slot = document.createElement('div');
    slot.classList.add('slot');
    if (!post.available) {
      slot.classList.add('coming-soon');
    }
    const img = document.createElement('img');
    img.src = post.image;
    img.alt = post.title;
    slot.appendChild(img);
    // Label for coming soon items
    if (!post.available) {
      const label = document.createElement('div');
      label.classList.add('coming-label');
      label.textContent = 'Coming Soon';
      slot.appendChild(label);
    }
    // Click handler for available items
    if (post.available) {
      slot.addEventListener('click', () => {
        questTitle.textContent = post.title;
        questText.textContent = post.description;
        questBox.classList.remove('hidden');
      });
    }
    return slot;
  }

  // Populate backpack grid
  posts.forEach((post) => {
    const slot = createSlot(post);
    backpack.appendChild(slot);
  });

  // Close quest pop-up
  closeQuestBtn.addEventListener('click', () => {
    questBox.classList.add('hidden');
  });
});