// Extracted from index.html - syncFromEpic and sprite parsing helpers
// Date: 2026-08-25
// WARNING: This code uses broken quest-based detection that doesn't work.
// The actual sprite state is NOT available in MCP profiles.

// === SPRITE MAPS (embedded in syncFromEpic) ===


// === MAIN SYNC FUNCTION ===

async function syncFromEpic(token){
  const locker = await epicAuth.getLocker(token);

  // DEBUG: Log all sprite-related items
  const spriteItems = locker.cosmetics.filter(c => {
    const id = (c.templateId || '').toLowerCase();
    return id.includes('sprite') || id.includes('creature') || id.includes('s41') || id.includes('s42');
  });

  // DEBUG: Look for S4 sprite ownership indicators (not quests)
  const s4OwnershipItems = locker.cosmetics.filter(c => {
    const id = (c.templateId || '').toLowerCase();
    // Look for tokens, cosmetics, or other items that might indicate S4 sprite ownership
    return (id.includes('s42') || id.includes('sprite')) &&
           !id.startsWith('quest:') &&
           !id.startsWith('challengebundle') &&
           !id.startsWith('challengebundleschedule');
  });
  console.log('=== S4 SPRITE OWNERSHIP ITEMS (non-quest) ===');
  console.table(s4OwnershipItems.map(c => ({ templateId: c.templateId, attrs: JSON.stringify(c.attributes) })));

  // Log which profiles were loaded (for debugging S4 sprite locations)
  if(locker.debug_profiles_loaded){
    console.log('=== PROFILES LOADED ===');
    console.table(locker.debug_profiles_loaded);
  }
  // Log stats data - sprite ownership might be here!
  console.log('=== SPRITE-RELATED STATS ===');
  console.log(locker.debug_sprite_stats || 'none found');
  console.log('=== ALL STATS KEYS ===');
  console.log(locker.debug_all_stats_keys || 'none returned');

  // NEW: Backend gold/cheat raw items search
  console.log('=== BACKEND: GOLD/CHEAT RAW ITEMS ===');
  console.log(locker.debug_gold_cheat_items || 'none found');
  if(locker.debug_gold_cheat_items?.length){
    for(const item of locker.debug_gold_cheat_items){
      console.log('GOLD/CHEAT ITEM:', item.templateId);
      console.log('  FULL:', JSON.stringify(item, null, 2));
    }
  }

  // NEW: Backend sprite cosmetics search
  console.log('=== BACKEND: SPRITE COSMETICS ===');
  console.log(locker.debug_sprite_cosmetics || 'none found');
  if(locker.debug_sprite_cosmetics?.length){
    for(const item of locker.debug_sprite_cosmetics){
      console.log('SPRITE COSMETIC:', item.templateId);
      console.log('  FULL:', JSON.stringify(item, null, 2));
    }
  }
  console.log('=== ALL SPRITE-RELATED LOCKER ITEMS ===');
  console.table(spriteItems.map(c => ({
    templateId: c.templateId,
    quantity: c.quantity,
    level: c.attributes?.level,
    state: c.attributes?.quest_state
  })));
  window.lastLockerDebug = spriteItems;

  // DEBUG: Look for sprite cosmetics (pets, backblings, creatures)
  const possibleSpriteCosmetics = locker.cosmetics.filter(c => {
    const id = (c.templateId || '').toLowerCase();
    return id.includes('pet') || id.includes('backpack') || id.includes('creature') ||
           id.includes('sprite') || id.includes('blockstack');
  });
  console.log('=== POSSIBLE SPRITE COSMETICS (pets/backblings/creatures) ===');
  console.table(possibleSpriteCosmetics.map(c => ({
    templateId: c.templateId,
    attrs: JSON.stringify(c.attributes).substring(0, 200)
  })));

  // DEBUG: Check the generic sprite token's full attributes
  const genericToken = locker.cosmetics.find(c => c.templateId === 'Token:athena_s42_spritemastery_token_generic');
  if(genericToken){
    console.log('=== GENERIC SPRITE TOKEN FULL ATTRIBUTES ===');
    console.log(JSON.stringify(genericToken.attributes, null, 2));
  }

  // DEBUG: Look for any item with variants/styles that might indicate owned sprites
  const itemsWithVariants = locker.cosmetics.filter(c => {
    const attrs = c.attributes || {};
    return attrs.variants || attrs.item_variants || attrs.owned_variants;
  });
  console.log('=== ITEMS WITH VARIANTS ===');
  console.table(itemsWithVariants.slice(0, 20).map(c => ({
    templateId: c.templateId,
    variants: JSON.stringify(c.attributes?.variants || c.attributes?.item_variants || c.attributes?.owned_variants).substring(0, 200)
  })));

  // DEBUG: Search for any gold/cheatmaster indicators (items with "gold" or "cheat" in name)
  const goldCheatItems = locker.cosmetics.filter(c => {
    const id = (c.templateId || '').toLowerCase();
    return (id.includes('gold') || id.includes('cheat') || id.includes('progression')) &&
           (id.includes('sprite') || id.includes('s42'));
  });
  console.log('=== GOLD/CHEATMASTER INDICATOR ITEMS ===');
  console.table(goldCheatItems.map(c => ({
    templateId: c.templateId,
    state: c.attributes?.quest_state,
    attrs: JSON.stringify(c.attributes || {}).substring(0, 150)
  })));

  // DEBUG: Dump ALL S42 tokens (potential gold/CM ownership indicators)
  const s42Tokens = locker.cosmetics.filter(c => {
    const id = (c.templateId || '').toLowerCase();
    return id.startsWith('token:') && id.includes('s42');
  });
  console.log('=== ALL S42 TOKENS ===');
  console.table(s42Tokens.map(c => ({
    templateId: c.templateId,
    attrs: JSON.stringify(c.attributes || {})
  })));

  // DEBUG: Look for sprite pet/backbling cosmetics with variant data
  const spritePetBackblings = locker.cosmetics.filter(c => {
    const id = (c.templateId || '').toLowerCase();
    return (id.includes('athenabackpack:') || id.includes('athenapet:')) &&
           (id.includes('sprite') || id.includes('s42') || id.includes('s41'));
  });
  console.log('=== S4 SPRITE PET/BACKBLING COSMETICS ===');
  for(const item of spritePetBackblings){
    console.log(item.templateId);
    console.log('  FULL ATTRS:', JSON.stringify(item.attributes, null, 2));
  }

  // DEBUG: Look for extraction-related items
  const extractionItems = locker.cosmetics.filter(c => {
    const id = (c.templateId || '').toLowerCase();
    return id.includes('extract') || id.includes('capture') || id.includes('acquire');
  });
  console.log('=== EXTRACTION/CAPTURE ITEMS ===');
  console.table(extractionItems.map(c => ({
    templateId: c.templateId,
    state: c.attributes?.quest_state,
    completion: Object.keys(c.attributes || {}).filter(k => k.includes('completion')).map(k => `${k}=${c.attributes[k]}`).join(', ')
  })));

  // ===== S3 TOKEN-BASED DETECTION =====
  // Token format: "Token:athena_s41_spritemastery_token_qXX[letter]"
  // Token mapping based on variant letter analysis:
  // q01: d,e,g (holofoil+gem+quack, no cube) = water
  // q02: d,f,g (holofoil+cube+quack, no gem) = fire
  // q03: e,f,g (gem+cube+quack, no holofoil) = earth
  // q11: all 8 variants = zeropoint
  // q18: d,e,f (holofoil+gem+cube, no quack) = grim
  // q19: e,f (gem+cube) = batman variant updated?
  // q10, q22, q23 = normal-only mythics
  const S3_SPRITE_MAP = {
    '01': 'water', '02': 'fire', '03': 'earth', '04': 'fishy', '05': 'air',
    '06': 'duck', '07': 'ghost', '08': 'demon', '09': 'king', '10': 'striker',
    '11': 'zeropoint', '12': 'aura', '13': 'dream', '14': 'punk', '15': 'boss',
    '16': 'seven', '17': 'llama', '18': 'grim', '19': 'batman',
    '21': 'ironmouse', '22': 'johnwick', '23': 'pollo', '24': 'vinijr',
    '25': 'peely', '26': 'burntpeanut'
  };
  const S3_VARIANT_MAP = {
    '': 'normal', 'a': 'gold', 'b': 'gummy', 'c': 'galaxy',
    'd': 'holofoil', 'e': 'gem', 'f': 'cube', 'g': 'quack'
  };

  // DEBUG: Check Blockstack skin/backbling variants - sprites might be tracked as variants!
  const blockstackItems = locker.cosmetics.filter(c =>
    c.templateId?.toLowerCase().includes('blockstack')
  );
  console.log('=== BLOCKSTACK ITEMS (character/backbling with variants) ===');
  for(const item of blockstackItems){
    console.log(item.templateId);
    console.log('  FULL ATTRS:', JSON.stringify(item.attributes, null, 2));
  }

  // DEBUG: Check for sprite-specific mastery tokens (reward from quests)
  const s4SpriteTokens = locker.cosmetics.filter(c =>
    c.templateId?.includes('athena_s42_spritemastery_token_') &&
    !c.templateId?.includes('_generic')
  );
  console.log('=== S4 SPRITE-SPECIFIC TOKENS (ownership indicators) ===');
  console.table(s4SpriteTokens.map(c => ({ templateId: c.templateId })));

  // DEBUG: Check for battlepass sprite backbling token
  const bpSpriteToken = locker.cosmetics.find(c =>
    c.templateId?.includes('battlepasss42_spritebackbling')
  );
  console.log('=== BATTLE PASS SPRITE BACKBLING TOKEN ===');
  console.log(bpSpriteToken ? JSON.stringify(bpSpriteToken, null, 2) : 'NOT FOUND');

  // ===== S4 QUEST-BASED DETECTION =====
  // Quest format: "Quest:quest_s42_spritemastery_[spritename]" = base owned (normal + gold unlocked)
  // Quest format: "Quest:quest_s42_spritemastery_[spritename]_01" + Claimed = Cheatmaster mastered
  // S4 has 11 sprites: Klombo, Sonic, Tails, Shadow, Jackrabbit, 8-Bit, Crown, Adventure, Bush, Jonesy, Killswitch
  const S4_SPRITE_MAP = {
    '8bit': '8bit',
    'dwarf': 'adventure',
    'bushranger': 'bush',
    'jonesy': 'jonesy',
    'stormscout': 'stormscout',
    'killswitch': 'killswitch',
    'reloadovertime': 'shadow',
    'narrowflea': 'sonic',
    'narrowfleamonkey': 'tails',
    'doublejump': 'jackrabbit',
    'crown': 'crown',
    'klombo': 'klombo'
  };

  let s3Count = 0, s4Count = 0;

  // Clear old S4 state (since we can't reliably detect all S4 sprites yet)
  for(const key of Object.keys(state)){
    if(key.startsWith('s4:')) delete state[key];
  }

  // ===== S4 BLOCKSTACK VARIANT-BASED DETECTION =====
  // The Blockstack character skin's variant data encodes sprite ownership!
  // Material channel Stage values = base sprite ownership
  // Each Stage number corresponds to a specific sprite
  const BLOCKSTACK_STAGE_MAP = {
    // Stage number -> sprite internal name (mapping based on data analysis)
    // User owns: killswitch, 8bit, adventure, crown, jackrabbit, jonesy, shadow, sonic, tails
    // Has stages: 6, 9, 10, 11, 12, 13, 15, 16, 17
    // Missing sprites: bush, stormscout, klombo (would be 7, 8, 14?)
    'Stage6': 'killswitch',
    'Stage9': 'tails',
    'Stage10': 'jackrabbit',
    'Stage11': 'crown',
    'Stage12': '8bit',
    'Stage13': 'adventure',
    'Stage15': 'jonesy',
    'Stage16': 'shadow',
    'Stage17': 'sonic',
    // Not owned sprites (estimated):
    'Stage7': 'bush',
    'Stage8': 'stormscout',
    'Stage14': 'klombo'
  };

  // Find the Blockstack character and parse its variants
  const blockstackChar = locker.cosmetics.find(c =>
    c.templateId === 'AthenaCharacter:character_blockstack'
  );

  // First pass: collect all S4 quest states AND completion objectives for detection
  // Completion objectives indicate sprite ownership even when quest is still Active
  const s4QuestStates = {};  // { spriteId: { base: 'Claimed', '01': 'Active', '02': 'Claimed' } }
  const s4QuestCompletions = {}; // { spriteId: { base: 1, '01': 0, '02': 1 } } - completion obj counts
  for(const item of locker.cosmetics){
    const templateId = item.templateId || '';
    if(templateId.startsWith('Quest:quest_s42_spritemastery_')){
      const questId = templateId.replace('Quest:quest_s42_spritemastery_', '');
      const questState = item.attributes?.quest_state;
      const match = questId.match(/^([a-z0-9]+)(?:_(\d+))?$/);
      if(match){
        const spriteName = match[1];
        const levelNum = match[2] || 'base';
        const spriteId = S4_SPRITE_MAP[spriteName];
        if(spriteId){
          if(!s4QuestStates[spriteId]) s4QuestStates[spriteId] = {};
          s4QuestStates[spriteId][levelNum] = questState;

          // Also capture completion objective count - this indicates ownership!
          // Key format: completion_quest_s42_spritemastery_xxx_01_obj0
          const completionKey = 'completion_quest_s42_spritemastery_' + questId + '_obj0';
          const completionCount = item.attributes?.[completionKey] || 0;
          if(!s4QuestCompletions[spriteId]) s4QuestCompletions[spriteId] = {};
          s4QuestCompletions[spriteId][levelNum] = completionCount;
        }
      }
    }
  }
  console.log('S4 quest states:', s4QuestStates);
  console.log('S4 quest completions:', s4QuestCompletions);

  // Store debug data for on-screen display (helps diagnose issues on mobile)
  window.S4_DEBUG = {
    hasBlockstack: !!blockstackChar,
    questStates: s4QuestStates,
    questCompletions: s4QuestCompletions,
    variants: {}
  };

  if(blockstackChar?.attributes?.variants){
    console.log('=== BLOCKSTACK VARIANT-BASED S4 DETECTION ===');
    const variants = blockstackChar.attributes.variants;

    // Store raw variant data for debug panel
    for(const v of variants){
      window.S4_DEBUG.variants[v.channel] = v.owned || [];
    }

    // Material channel contains Stage values = base sprite ownership
    // Note: Stage can appear even for extracted cheatmasters, so we also require
    // quest evidence (base quest started/claimed) to confirm true ownership
    const materialVariant = variants.find(v => v.channel === 'Material');
    if(materialVariant?.owned){
      const ownedStages = materialVariant.owned.filter(v => v.startsWith('Stage'));
      console.log('Owned Stage values:', ownedStages);

      for(const stage of ownedStages){
        const spriteId = BLOCKSTACK_STAGE_MAP[stage];
        if(spriteId && !state['s4:' + spriteId + ':normal']){
          // Require BASE quest to exist (not just any quest like gold/cheatmaster)
          // This prevents false positives from extracted CMs where Stage value exists
          // but user doesn't actually own the base sprite
          const baseQuestState = s4QuestStates[spriteId]?.base;
          const hasBaseQuest = baseQuestState === 'Active' || baseQuestState === 'Claimed';
          if(hasBaseQuest){
            const baseMastered = baseQuestState === 'Claimed';
            state['s4:' + spriteId + ':normal'] = { owned: true, mastered: baseMastered };
            s4Count++;
            console.log(`  ${stage} -> ${spriteId}:normal (via Blockstack variants)${baseMastered ? ' [MASTERED]' : ''}`);
          } else {
            console.log(`  ${stage} -> ${spriteId}:normal SKIPPED (no base quest - likely extracted CM only)`);
          }
        }
      }
    }

    // MaterialParamSets Particle values = gold sprite ownership
    // Confirmed mappings based on user data
    const BLOCKSTACK_GOLD_MAP = {
      'Particle1': 'jackrabbit',
      'Particle2': 'jonesy',
      'Particle9': 'tails',
      'Particle13': 'adventure',
      // Likely mappings (Stage number = Particle number)
      'Particle6': 'killswitch',
      'Particle11': 'crown',
      'Particle12': '8bit',
      'Particle16': 'shadow',
      'Particle17': 'sonic'
    };

    // Mat values in MaterialParamSets can also indicate gold (Stage number mapping)
    const BLOCKSTACK_GOLD_MAT_MAP = {
      'Mat16': 'shadow'  // Stage16 = shadow
    };

    const paramSets = variants.find(v => v.channel === 'MaterialParamSets');
    if(paramSets?.owned){
      const ownedParticles = paramSets.owned.filter(v => v.startsWith('Particle'));
      const ownedMats = paramSets.owned.filter(v => v.startsWith('Mat'));
      console.log('Owned Particle values (gold):', ownedParticles);
      console.log('Owned Mat values (MaterialParamSets):', ownedMats);

      // Detect gold via Particle values
      for(const particle of ownedParticles){
        const spriteId = BLOCKSTACK_GOLD_MAP[particle];
        if(spriteId && !state['s4:' + spriteId + ':gold']){
          if(!state['s4:' + spriteId + ':normal']){
            state['s4:' + spriteId + ':normal'] = { owned: true, mastered: false };
            s4Count++;
          }
          state['s4:' + spriteId + ':gold'] = { owned: true, mastered: false };
          s4Count++;
          console.log(`  ${particle} -> ${spriteId}:gold (via Blockstack Particle)`);
        }
      }

      // Detect gold via Mat values
      for(const mat of ownedMats){
        const spriteId = BLOCKSTACK_GOLD_MAT_MAP[mat];
        if(spriteId && !state['s4:' + spriteId + ':gold']){
          if(!state['s4:' + spriteId + ':normal']){
            state['s4:' + spriteId + ':normal'] = { owned: true, mastered: false };
            s4Count++;
          }
          state['s4:' + spriteId + ':gold'] = { owned: true, mastered: false };
          s4Count++;
          console.log(`  ${mat} -> ${spriteId}:gold (via Blockstack Mat)`);
        }
      }
    }

    // MaterialParamSets2 = cheatmaster ownership
    // Particle values for most sprites, Mat27 = bush (Stage7 + 20)
    const BLOCKSTACK_CHEATMASTER_PARTICLE_MAP = {
      'Particle0': 'tails',
      'Particle3': 'adventure',
      'Particle10': '8bit',
      'Particle14': 'crown',
      'Particle15': 'jonesy'
      // Note: Particle6, 7, 11, 16, 17 were removed - caused false positives
    };

    // Mat values for cheatmaster (Stage + 20 offset)
    const BLOCKSTACK_CHEATMASTER_MAT_MAP = {
      'Mat27': 'bush'   // Stage7 + 20 = 27
    };

    const paramSets2 = variants.find(v => v.channel === 'MaterialParamSets2');
    // Also need paramSets for CM mastery check (some mastery Mats are in gold channel)
    const allMasteryMats = [...(paramSets?.owned || []), ...(paramSets2?.owned || [])].filter(v => v.startsWith('Mat'));

    if(paramSets2?.owned){
      const ownedParticles2 = paramSets2.owned.filter(v => v.startsWith('Particle'));
      const ownedMats2 = paramSets2.owned.filter(v => v.startsWith('Mat'));
      console.log('MaterialParamSets2 Particle values (cheatmaster):', ownedParticles2);
      console.log('MaterialParamSets2 Mat values:', ownedMats2);

      // Detect via Particle values
      // CM mastery: Mat(Particle+20) in MaterialParamSets or MaterialParamSets2
      // Note: Cheatmaster can be obtained by extracting from another player,
      // so having CM does NOT mean you have the normal variant!
      for(const particle of ownedParticles2){
        const spriteId = BLOCKSTACK_CHEATMASTER_PARTICLE_MAP[particle];
        if(spriteId && !state['s4:' + spriteId + ':cheatmaster']){
          // Check CM mastery: Mat(Particle+20) in paramSets or paramSets2
          const particleNum = parseInt(particle.replace('Particle', ''));
          const masteryMat = 'Mat' + (particleNum + 20);
          const cmMastered = allMasteryMats.includes(masteryMat);
          state['s4:' + spriteId + ':cheatmaster'] = { owned: true, mastered: cmMastered };
          s4Count++;
          console.log(`  ${particle} -> ${spriteId}:cheatmaster (via Blockstack variants)${cmMastered ? ' [MASTERED]' : ''}`);
        }
      }

      // Detect via Mat values (e.g., Mat27 = bush cheatmaster)
      // Mat-based CM mastery: _01 quest Claimed
      for(const mat of ownedMats2){
        const spriteId = BLOCKSTACK_CHEATMASTER_MAT_MAP[mat];
        if(spriteId && !state['s4:' + spriteId + ':cheatmaster']){
          const cmMastered = s4QuestStates[spriteId]?.['01'] === 'Claimed';
          state['s4:' + spriteId + ':cheatmaster'] = { owned: true, mastered: cmMastered };
          s4Count++;
          console.log(`  ${mat} -> ${spriteId}:cheatmaster (via Blockstack Mat variants)${cmMastered ? ' [MASTERED]' : ''}`);
        }
      }
    }

    // MaterialParamSets3 = additional cheatmaster data
    // Mat37 = sonic (Stage17 + 20)
    const BLOCKSTACK_CHEATMASTER_MAT3_MAP = {
      'Mat37': 'sonic'  // Stage17 + 20 = 37
    };

    const paramSets3 = variants.find(v => v.channel === 'MaterialParamSets3');
    if(paramSets3?.owned){
      const ownedMats3 = paramSets3.owned.filter(v => v.startsWith('Mat'));

      // Mat-based CM in MaterialParamSets3 (sonic), mastery = _01 quest Claimed
      for(const mat of ownedMats3){
        const spriteId = BLOCKSTACK_CHEATMASTER_MAT3_MAP[mat];
        if(spriteId && !state['s4:' + spriteId + ':cheatmaster']){
          const cmMastered = s4QuestStates[spriteId]?.['01'] === 'Claimed';
          state['s4:' + spriteId + ':cheatmaster'] = { owned: true, mastered: cmMastered };
          s4Count++;
          console.log(`  ${mat} -> ${spriteId}:cheatmaster (via MaterialParamSets3)${cmMastered ? ' [MASTERED]' : ''}`);
        }
      }
    }
  } else {
    // FALLBACK: No Blockstack skin - use quest completion counts + state
    // completion >= 1 on base = started mastery = OWNS base sprite
    // Claimed on _01/_02 = mastered gold/CM
    // Gold/CM ownership without mastery CANNOT be detected without Blockstack
    console.log('=== QUEST-BASED S4 DETECTION (no Blockstack skin) ===');

    for(const [spriteId, quests] of Object.entries(s4QuestStates)){
      const baseState = quests.base || quests['00'];
      const goldState = quests['01'];
      const cmState = quests['02'];

      // Get completion counts
      const completions = s4QuestCompletions[spriteId] || {};
      const baseCompletion = completions.base || completions['00'] || 0;
      const goldCompletion = completions['01'] || 0;
      const cmCompletion = completions['02'] || 0;

      // Base sprite: Claimed = mastered, OR completion >= 1 = has started mastery = owns
      if(baseState === 'Claimed'){
        state['s4:' + spriteId + ':normal'] = { owned: true, mastered: true };
        s4Count++;
        console.log(`  ${spriteId}:normal (quest Claimed)`);
      } else if(baseCompletion >= 1){
        state['s4:' + spriteId + ':normal'] = { owned: true, mastered: false };
        s4Count++;
        console.log(`  ${spriteId}:normal (completion=${baseCompletion})`);
      }

      // Gold: _01 Claimed = gold mastered, completion >= 1 = started gold mastery = owns gold
      if(goldState === 'Claimed'){
        if(!state['s4:' + spriteId + ':normal']){
          state['s4:' + spriteId + ':normal'] = { owned: true, mastered: true };
          s4Count++;
        }
        state['s4:' + spriteId + ':gold'] = { owned: true, mastered: true };
        s4Count++;
        console.log(`  ${spriteId}:gold (_01 Claimed)`);
      } else if(goldCompletion >= 1){
        if(!state['s4:' + spriteId + ':normal']){
          state['s4:' + spriteId + ':normal'] = { owned: true, mastered: false };
          s4Count++;
        }
        state['s4:' + spriteId + ':gold'] = { owned: true, mastered: false };
        s4Count++;
        console.log(`  ${spriteId}:gold (completion=${goldCompletion})`);
      }

      // Cheatmaster: _02 Claimed = CM mastered, completion >= 1 = owns CM
      if(cmState === 'Claimed'){
        if(!state['s4:' + spriteId + ':normal']){
          state['s4:' + spriteId + ':normal'] = { owned: true, mastered: true };
          s4Count++;
        }
        state['s4:' + spriteId + ':cheatmaster'] = { owned: true, mastered: true };
        s4Count++;
        console.log(`  ${spriteId}:cheatmaster (_02 Claimed)`);
      } else if(cmCompletion >= 1){
        if(!state['s4:' + spriteId + ':normal']){
          state['s4:' + spriteId + ':normal'] = { owned: true, mastered: false };
          s4Count++;
        }
        state['s4:' + spriteId + ':cheatmaster'] = { owned: true, mastered: false };
        s4Count++;
        console.log(`  ${spriteId}:cheatmaster (completion=${cmCompletion})`);
      }
    }

    console.log('NOTE: Gold/CM without mastery progress cannot be detected without Blockstack skin');
  }

  for(const item of locker.cosmetics){
    const templateId = item.templateId || '';

    // S3: Token-based mastery (prefix keys with s3:)
    if(templateId.startsWith('Token:athena_s41_spritemastery_token_q')){
      const tokenId = templateId.replace('Token:athena_s41_spritemastery_token_q', '');
      const match = tokenId.match(/^(\d+)([a-g]?)$/);
      if(match){
        const spriteNum = match[1].padStart(2, '0');
        const variantLetter = match[2] || '';
        const spriteId = S3_SPRITE_MAP[spriteNum];
        const variantId = S3_VARIANT_MAP[variantLetter];
        if(spriteId && variantId){
          const key = 's3:' + spriteId + ':' + variantId;
          state[key] = { owned: true, mastered: true };
          s3Count++;
        }
      }
    }

    // S4: Quest-based detection (prefix keys with s4:)
    if(templateId.startsWith('Quest:quest_s42_spritemastery_')){
      const questId = templateId.replace('Quest:quest_s42_spritemastery_', '');
      const questState = item.attributes?.quest_state;

      // Parse quest: "8bit", "8bit_01", "dwarf_02" etc
      const match = questId.match(/^([a-z0-9]+)(?:_(\d+))?$/);
      if(match){
        const spriteName = match[1];
        const levelNum = match[2] || '00';
        const spriteId = S4_SPRITE_MAP[spriteName];

        if(spriteId){
          // Track quest states for this sprite
          const stateKey = 's4:' + spriteId;
          if(!window._s4QuestDebug) window._s4QuestDebug = {};
          if(!window._s4QuestDebug[spriteId]) window._s4QuestDebug[spriteId] = {};
          window._s4QuestDebug[spriteId]['_' + levelNum] = questState;

          // Quest detection is secondary to Blockstack variant detection.
          // Gold from quest _01 is ONLY trusted if base was detected via Stage variants.
          // This prevents false gold for sprites like bush/sonic where user has
          // cheatmaster but not gold (their Stage isn't in Material owned list).

          if(questState === 'Claimed' && blockstackChar?.attributes?.variants){
            const materialVariant = blockstackChar.attributes.variants.find(v => v.channel === 'Material');
            const stageForSprite = Object.entries(BLOCKSTACK_STAGE_MAP).find(([stage, id]) => id === spriteId)?.[0];
            const hasStageOwned = stageForSprite && materialVariant?.owned?.includes(stageForSprite);

            // Only trust quest for base/gold if Stage is owned in variants
            // Note: Can't reliably detect extracted CMs - API data looks identical
            if(hasStageOwned && !state['s4:' + spriteId + ':normal']){
              state['s4:' + spriteId + ':normal'] = { owned: true, mastered: levelNum === '00' };
              s4Count++;
              console.log(`  Quest ${questId} Claimed -> ${spriteId}:normal (Stage-verified)`);
            }

            // Trust quest _01 gold if Stage is owned, unless it's a Mat-based CM sprite
            if(levelNum === '01' && hasStageOwned){
              const matCheatmasterSprites = ['bush', 'sonic']; // Sprites that use Mat-based CM detection
              const hasMatBasedCM = matCheatmasterSprites.includes(spriteId) && state['s4:' + spriteId + ':cheatmaster'];

              if(!state['s4:' + spriteId + ':gold'] && !hasMatBasedCM){
                state['s4:' + spriteId + ':gold'] = { owned: true, mastered: false };
                s4Count++;
                console.log(`  Quest ${questId} Claimed -> ${spriteId}:gold (Stage-verified)`);
              }
            }
          }
        }
      }
    }
  }

  // Collab sprites (ironmouse, vinijr) - Epic API doesn't return their tokens
  // Mark as unfetchable so UI can show appropriate message
  if(!state['s3:ironmouse:normal']) {
    state['s3:ironmouse:normal'] = { owned: false, mastered: false, unfetchable: true };
  }
  if(!state['s3:vinijr:normal']) {
    state['s3:vinijr:normal'] = { owned: false, mastered: false, unfetchable: true };
  }

  console.log(`Synced: ${s3Count} S3 sprites, ${s4Count} S4 sprites`);

  // Debug: show all state keys by season
  const s3Keys = Object.keys(state).filter(k => k.startsWith('s3:'));
  const s4Keys = Object.keys(state).filter(k => k.startsWith('s4:'));
  console.log(`State: ${s3Keys.length} S3 keys, ${s4Keys.length} S4 keys`);
  console.log('S3 state keys:', s3Keys.sort());
  console.log('S4 state:', s4Keys);

  // Debug: find mismatches between state and ENTRIES
  const s3EntryKeys = ENTRIES.filter(e => e.sprite.season === 's3').map(e => e.key);
  const stateNotInEntries = s3Keys.filter(k => !s3EntryKeys.includes(k));
  const entriesNotInState = s3EntryKeys.filter(k => !s3Keys.includes(k));
  console.log('Keys in STATE but NOT in entries:', stateNotInEntries);
  console.log('Keys in ENTRIES but NOT in state:', entriesNotInState);

  // Store account level and first season for profile display
  if(locker.account_level) localStorage.setItem('epic_account_level', locker.account_level);
  if(locker.first_season) localStorage.setItem('epic_first_season', locker.first_season);
  if(locker.equipped_skin) localStorage.setItem('epic_equipped_skin', locker.equipped_skin);

  save();
  render();
}
