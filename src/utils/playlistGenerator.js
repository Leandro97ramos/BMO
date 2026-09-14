/**
 * Weighted Playlist Generator for BMO Media Session
 * Generates continuous playlist queue based on user-defined tag percentage weights.
 */

/**
 * Generate a weighted randomized playlist queue from tag folders and user percentages.
 * @param {Array} tagsList Array of { tagName, clips }
 * @param {Object} tagWeights Map of tagName -> percentage weight (0-100)
 * @param {number} queueLength Number of clips to pre-generate in the queue
 */
export function generateWeightedPlaylist(tagsList, tagWeights, queueLength = 120) {
  if (!tagsList || tagsList.length === 0) return [];

  // 1. Calculate active tags with weight > 0
  const activeTags = tagsList.filter(t => (tagWeights[t.tagName] || 0) > 0 && t.clips.length > 0);

  // If no weights set or all 0, default to equal distribution
  if (activeTags.length === 0) {
    const validTags = tagsList.filter(t => t.clips.length > 0);
    if (validTags.length === 0) return [];
    
    const equalWeight = 100 / validTags.length;
    const defaultWeights = {};
    validTags.forEach(t => defaultWeights[t.tagName] = equalWeight);
    return buildQueue(validTags, defaultWeights, queueLength);
  }

  return buildQueue(activeTags, tagWeights, queueLength);
}

function buildQueue(activeTags, tagWeights, queueLength) {
  // Normalize weights
  const totalWeightSum = activeTags.reduce((sum, tag) => sum + (tagWeights[tag.tagName] || 0), 0);
  
  if (totalWeightSum === 0) return [];

  const normalizedTags = activeTags.map(tag => ({
    ...tag,
    probability: (tagWeights[tag.tagName] || 0) / totalWeightSum
  }));

  const queue = [];
  let lastTagName = null;

  for (let i = 0; i < queueLength; i++) {
    // Weighted selection (Lottery wheel method)
    let randomVal = Math.random();
    let selectedTagObj = normalizedTags[0];

    for (let j = 0; j < normalizedTags.length; j++) {
      if (randomVal < normalizedTags[j].probability) {
        selectedTagObj = normalizedTags[j];
        break;
      }
      randomVal -= normalizedTags[j].probability;
    }

    // Try to avoid picking the exact same tag 3 times in a row if multiple tags exist
    if (normalizedTags.length > 1 && selectedTagObj.tagName === lastTagName && Math.random() < 0.5) {
      const otherTags = normalizedTags.filter(t => t.tagName !== lastTagName);
      if (otherTags.length > 0) {
        selectedTagObj = otherTags[Math.floor(Math.random() * otherTags.length)];
      }
    }

    lastTagName = selectedTagObj.tagName;

    // Pick a random clip from the selected tag folder
    const randomClipIndex = Math.floor(Math.random() * selectedTagObj.clips.length);
    const clip = selectedTagObj.clips[randomClipIndex];

    queue.push({
      clip,
      tagName: selectedTagObj.tagName,
      clipIndex: randomClipIndex,
      weightPercentage: Math.round((tagWeights[selectedTagObj.tagName] || 0))
    });
  }

  return queue;
}

/**
 * Calculate equal percentage distribution helper
 */
export function getEqualWeights(tagsList) {
  if (!tagsList || tagsList.length === 0) return {};
  const weightPerTag = Math.floor(100 / tagsList.length);
  const remainder = 100 - (weightPerTag * tagsList.length);

  const weights = {};
  tagsList.forEach((tag, idx) => {
    weights[tag.tagName] = weightPerTag + (idx === 0 ? remainder : 0);
  });
  return weights;
}
