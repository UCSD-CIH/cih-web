<link rel="stylesheet" href="https://use.typekit.net/tri2vlr.css">

<script>
(function (Drupal, once) {
  var pressMediaListingPath = '/research/media';
  var pressMediaTypeLabelOverrides = {
    'article': '50',
    'broadcast': '53',
    'video': '49'
  };
  var studyFocusCollapseTimers = new WeakMap();

  Drupal.behaviors.adminBodyClass = {
    attach: function (context) {
      if (typeof drupalSettings === 'undefined' || !drupalSettings.path || !drupalSettings.path.isAdmin) return;

      once('adminBodyClass', 'body', context).forEach(function (bodyEl) {
        bodyEl.classList.add('is-admin-page');
      });
    }
  };

  Drupal.behaviors.profileCardPageClass = {
    attach: function (context) {
      once('profileCardPageClass', 'body', context).forEach(function (bodyEl) {
        if (document.querySelector(
          '.view-id-profiles_cards, .view-profiles-cards'
        )) {
          bodyEl.classList.add('has-profile-card-view');
        }
      });
    }
  };

  function normalizePathSegment(segment) {
    return (segment || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getPrimaryPathSection() {
    var pathname = (window.location.pathname || '/').replace(/\/+/g, '/');
    var segments = pathname.split('/').filter(function (segment) {
      return !!segment;
    });

    if (!segments.length) return 'home';
    return normalizePathSegment(segments[0]) || 'home';
  }

  Drupal.behaviors.footerParallaxSectionClass = {
    attach: function (context) {
      once('footerParallaxSectionClass', 'body', context).forEach(function (bodyEl) {
        var section = getPrimaryPathSection();
        if (!section) return;

        bodyEl.classList.add('has-footer-parallax');
        bodyEl.classList.add('site-section-' + section);
        bodyEl.setAttribute('data-site-section', section);
      });
    }
  };

  Drupal.behaviors.webformLabelFontFix = {
    attach: function (context) {
      once('webformLabelFontFix', '.webform-submission-form .js-form-wrapper.form-wrapper, .webform-submission-form label.h3', context).forEach(function (node) {
        if (!node || !node.hasAttribute || !node.hasAttribute('style')) return;
        node.removeAttribute('style');
      });
    }
  };

  function extractTermIdFromHref(href) {
    if (!href) return null;

    var decoded = href;
    try {
      decoded = decodeURIComponent(href);
    } catch (e) {
      decoded = href;
    }

    var taxonomyMatch = decoded.match(/\/taxonomy\/term\/(\d+)(?:[/?#]|$)/);
    if (taxonomyMatch && taxonomyMatch[1]) {
      return taxonomyMatch[1];
    }

    var filterMatch = decoded.match(/field_(?:press_type|study_status|study_focus|study_type)_target_id\[(\d+)\]/i);
    if (filterMatch && filterMatch[1]) return filterMatch[1];

    var encodedFilterMatch = href.match(/field_(?:press_type|study_status|study_focus|study_type)_target_id%5B(\d+)%5D/i);
    if (encodedFilterMatch && encodedFilterMatch[1]) return encodedFilterMatch[1];

    var plainFilterMatch = decoded.match(/field_(?:press_type|study_status|study_focus|study_type)_target_id=?(\d+)/i);
    if (plainFilterMatch && plainFilterMatch[1]) return plainFilterMatch[1];

    return null;
  }

  function buildPressTypeFilterUrl(termId) {
    var encodedId = encodeURIComponent(termId);
    return pressMediaListingPath +
      '?field_press_type_target_id%5B' + encodedId + '%5D=' + encodedId +
      '&keys=';
  }

  function removeNoopener(link) {
    var relValue = link.getAttribute('rel');
    if (!relValue) return;
    var filtered = relValue
      .split(/\s+/)
      .filter(function (token) {
        return token.toLowerCase() !== 'noopener' && token !== '';
      });
    if (filtered.length) {
      link.setAttribute('rel', filtered.join(' '));
    } else {
      link.removeAttribute('rel');
    }
  }

  function rewritePressMediaTypeLink(link) {
    if (!link) return false;
    var href = link.getAttribute('href') || '';
    var match = href.match(/\/taxonomy\/term\/(\d+)(?:[/?#]|$)/);
    if (!match || !match[1]) return false;

    var termId = match[1];
    var labelKey = (link.textContent || '').trim().toLowerCase();
    var overrideId = pressMediaTypeLabelOverrides[labelKey];
    var targetId = overrideId || termId;

    link.setAttribute('href', buildPressTypeFilterUrl(targetId));
    link.setAttribute('data-term-id', targetId);
    link.removeAttribute('target');
    removeNoopener(link);
    return true;
  }

  function manageStudyFocusDetails(details) {
    if (!details || details.dataset.pmStudyFocusBound === '1') return;

    var checkboxSelector = 'input[type="checkbox"][name*="field_study_focus"]';
    var checkboxes = details.querySelectorAll(checkboxSelector);
    if (!checkboxes.length) return;

    details.dataset.pmStudyFocusBound = '1';

    function clearScheduledCollapse() {
      var timer = studyFocusCollapseTimers.get(details);
      if (timer) {
        clearTimeout(timer);
        studyFocusCollapseTimers.delete(details);
      }
    }

    function scheduleCollapse(delay) {
      clearScheduledCollapse();
      var timer = setTimeout(function () {
        details.removeAttribute('open');
        studyFocusCollapseTimers.delete(details);
      }, delay);
      studyFocusCollapseTimers.set(details, timer);
    }

    function anyChecked() {
      return !!details.querySelector(checkboxSelector + ':checked');
    }

    function handleChange() {
      if (anyChecked()) {
        clearScheduledCollapse();
        details.setAttribute('open', 'open');
      } else {
        scheduleCollapse(500);
      }
    }

    checkboxes.forEach(function (checkbox) {
      checkbox.addEventListener('change', handleChange);
      checkbox.addEventListener('focus', function () {
        clearScheduledCollapse();
        details.setAttribute('open', 'open');
      });
    });

    if (anyChecked()) {
      details.setAttribute('open', 'open');
    } else {
      details.removeAttribute('open');
    }
  }

  // Syncs each Press & Media card's title and thumbnail with the external link field.
  Drupal.behaviors.pressMediaCardLinker = {
    attach: function (context) {
      context.querySelectorAll('.press-media.press-media-card:not([data-pm-linked])').forEach(function (card) {
        card.setAttribute('data-pm-linked', '1');

        // 1) Get external URL
        var linkFieldA = card.querySelector('.field--name-field-press-link a');
        if (!linkFieldA || !linkFieldA.href) return;
        var url = linkFieldA.href;

        // 2) Hide original External Link field immediately (no flash)
        var linkField = card.querySelector('.field--name-field-press-link');
        if (linkField) linkField.style.display = 'none';

        // 3) TITLE → retarget or wrap
        var titleA = card.querySelector('h2 a');
        if (titleA) {
          titleA.href = url;
          titleA.target = '_blank';
          titleA.rel = 'noopener noreferrer';
        } else {
          var h2 = card.querySelector('h2');
          if (h2) {
            var a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = h2.textContent.trim();
            h2.textContent = '';
            h2.appendChild(a);
          }
        }

        // 4) THUMBNAIL → wrap the image or retarget existing link
        var thumbGroup = card.querySelector('.group--press-media-thumbnail');
        if (thumbGroup) {
          var img = thumbGroup.querySelector('.field--name-field-press-thumbnail img, .field--name-field-press-thumbnail picture img') 
                    || thumbGroup.querySelector('img, picture img');
          if (img) {
            var existing = img.closest('a');
            if (existing) {
              existing.href = url;
              existing.target = '_blank';
              existing.rel = 'noopener noreferrer';
            } else {
              var wrap = document.createElement('a');
              wrap.href = url;
              wrap.target = '_blank';
              wrap.rel = 'noopener noreferrer';
              wrap.className = 'pm-card-thumb-link';
              img.parentNode.insertBefore(wrap, img);
              wrap.appendChild(img);
            }
          }
        }

        card.querySelectorAll('.field--name-field-press-type a[href*="/taxonomy/term/"]').forEach(function (link) {
          rewritePressMediaTypeLink(link);
        });
      });
    }
  };

  // Adds data-term-id attributes to tags so icon CSS keeps working after link rewrites.
  Drupal.behaviors.termTagDataAttributes = {
    attach: function (context) {
      var selector = [
        '.field--name-field-press-type a[href]',
        '.field--name-field-study-status a[href]'
      ].join(', ');

      once('termTagDataAttributes', selector, context).forEach(function (link) {
        var termId = extractTermIdFromHref(link.getAttribute('href'));
        if (termId) {
          link.setAttribute('data-term-id', termId);
        }
      });
    }
  };

  // Routes Press & Media Type tag links back to the filtered listing view.
  Drupal.behaviors.pressTypeTagFilterLinks = {
    attach: function (context) {
      once('pressTypeTagFilterLinks', '.field--name-field-press-type a[href*="/taxonomy/term/"]', context)
        .forEach(function (link) {
          rewritePressMediaTypeLink(link);
        });
    }
  };

  // Keeps exposed filter accordions collapsed by default on Press & Media view.
  Drupal.behaviors.pressMediaFilterUI = {
    attach: function (context) {
      once('pressMediaFilterUI', '.view-press-media .view-filters', context).forEach(function (filters) {
        var detailsList = filters.querySelectorAll('details');
        detailsList.forEach(function (details) {
          details.removeAttribute('open');
        });

        var params = new URLSearchParams(window.location.search);
        var hasPressTypeParam = false;
        params.forEach(function (_, key) {
          if (key.indexOf('field_press_type_target_id') === 0) {
            hasPressTypeParam = true;
          }
        });

        if (hasPressTypeParam) {
          var typeInput = filters.querySelector('input[name*="field_press_type_target_id"]');
          if (typeInput) {
            var typeDetails = typeInput.closest('details');
            if (typeDetails) typeDetails.setAttribute('open', 'open');
          }
        }

        var studyFocusInput = filters.querySelector('input[name*="field_study_focus"]');
        if (studyFocusInput) {
          manageStudyFocusDetails(studyFocusInput.closest('details'));
        }
      });
    }
  };

  function isExternalUrl(href) {
    if (!href) return false;
    try {
      var url = new URL(href, window.location.origin);
      return url.origin !== window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function readFieldText(field) {
    if (!field) return '';

    var items = Array.prototype.slice.call(field.querySelectorAll('.field__item'));
    if (items.length) {
      var itemText = items
        .map(function (item) {
          return (item.textContent || '').trim();
        })
        .filter(function (text) {
          return !!text;
        })
        .join(', ')
        .trim();
      if (itemText) return itemText;
    }

    var link = field.querySelector('a');
    if (link) {
      var linkText = (link.textContent || '').trim();
      if (linkText) return linkText;
    }

    return (field.textContent || '').trim();
  }

  function normalizeToken(text) {
    return (text || '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  function getResourceDestinationType(card) {
    var field = card.querySelector('.field--name-field-resource-destination-type');
    var text = normalizeToken(readFieldText(field));
    if (text) return text;

    if (card.querySelector('.field--name-field-primary-file a[href]')) {
      return 'file_download';
    }
    if (card.querySelector('.field--name-field-primary-url a[href*="soundcloud.com"]')) {
      return 'soundcloud';
    }
    return '';
  }

  function getResourceType(card) {
    var field = card.querySelector('.field--name-field-resource-type');
    return normalizeToken(readFieldText(field));
  }

  function getResourceFallbackThumbnail(resourceType) {
    var fallbackMap = {
      video: '/sites/default/files/2026-03/resource-fallback-video-cih-3x2.png',
      link: '/sites/default/files/2026-03/resource-fallback-link-cih-3x2.png',
      webpage: '/sites/default/files/2026-03/resource-fallback-link-cih-3x2.png',
      audio: '/sites/default/files/2026-03/resource-fallback-audio-cih-3x2.png',
      article: '/sites/default/files/2026-03/resource-fallback-article-cih-3x2.png'
    };

    return fallbackMap[resourceType] || fallbackMap.article;
  }

  function ensureResourceThumbnail(card, resourceType) {
    if (!card) return;

    var content = card.querySelector('.content');
    if (!content) return;

    var thumbnailField = card.querySelector('.field--name-field-thumbnail-image');
    if (thumbnailField && thumbnailField.querySelector('img')) {
      return;
    }

    var fallbackSrc = getResourceFallbackThumbnail(resourceType || 'article');
    var fallbackAlt = ((resourceType || 'resource') + ' default thumbnail').replace(/^\w/, function (char) {
      return char.toUpperCase();
    });

    if (!thumbnailField) {
      thumbnailField = document.createElement('div');
      thumbnailField.className =
        'field field--name-field-thumbnail-image field--type-entity-reference field--label-hidden field__item';
      content.insertBefore(thumbnailField, content.firstChild);
    }

    thumbnailField.innerHTML =
      '<div class="field__item">' +
      '<img loading="lazy" src="' + fallbackSrc + '" alt="' + fallbackAlt + '" class="img-fluid" />' +
      '</div>';
  }

  function resourceCtaLabel(destinationType, resourceType) {
    if (destinationType === 'file_download') return 'Download';
    if (destinationType === 'soundcloud') return 'Listen';
    if (destinationType === 'video_platform') return 'Watch';
    if (resourceType === 'audio') return 'Listen';
    if (resourceType === 'video') return 'Watch';
    return 'Open Resource';
  }

  function findPrimaryResourceLink(card, destinationType) {
    var fileLink =
      card.querySelector('.field--name-field-resource-file a[href]') ||
      card.querySelector('.field--name-field-primary-file a[href]');
    if (destinationType === 'file_download' && fileLink) {
      return fileLink;
    }

    var urlLink =
      card.querySelector('.field--name-field-resource-url a[href]') ||
      card.querySelector('.field--name-field-primary-url a[href]');
    if (urlLink) return urlLink;

    if (fileLink) return fileLink;
    return card.querySelector('h2 a[href]');
  }

  function syncResourceCardCta(card) {
    if (!card) return;

    var destinationType = getResourceDestinationType(card);
    var resourceType = getResourceType(card);
    ensureResourceThumbnail(card, resourceType);
    var sourceLink = findPrimaryResourceLink(card, destinationType);
    if (!sourceLink) return;

    var href = sourceLink.getAttribute('href') || '';
    if (!href) return;

    var ctaLabel = resourceCtaLabel(destinationType, resourceType);
    var cta = card.querySelector('.resource-card__cta');
    if (!cta) {
      cta = document.createElement('a');
      cta.className = 'resource-card__cta';
      card.appendChild(cta);
    }

    cta.setAttribute('href', href);
    cta.textContent = ctaLabel;

    var sourceTarget = sourceLink.getAttribute('target');
    var sourceRel = sourceLink.getAttribute('rel');
    if (sourceTarget) {
      cta.setAttribute('target', sourceTarget);
    } else {
      cta.removeAttribute('target');
    }
    if (sourceRel) {
      cta.setAttribute('rel', sourceRel);
    } else {
      cta.removeAttribute('rel');
    }

    card.setAttribute('data-resource-destination-type', destinationType || 'unknown');
    card.setAttribute('data-resource-type', resourceType || 'unknown');
  }

  function enforceNavLink(link) {
    if (!link) return;

    var href = link.getAttribute('href') || '';
    if (!isExternalUrl(href)) return;

    if (link.getAttribute('target') !== '_self') {
      link.setAttribute('target', '_self');
    }
    removeNoopener(link);
  }

  function enhanceResourceCards(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(
      [
        '.view[class*="view-resources"] article.resource',
        '.view[class*="view-guided-meditations"] article.resource',
        '.view-id-resources article.resource',
        '.view-id-guided_meditations article.resource'
      ].join(', ')
    ).forEach(function (card) {
      if (!card.classList.contains('resource-card')) {
        card.classList.add('resource-card');
      }
      syncResourceCardCta(card);
    });
  }

  function enhanceResourceFilters(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(
      [
        '.view[class*="view-resources"] .view-filters',
        '.view[class*="view-guided-meditations"] .view-filters',
        '.view-id-resources .view-filters',
        '.view-id-guided_meditations .view-filters'
      ].join(', ')
    ).forEach(function (filters) {
      var searchInput = filters.querySelector('.form-item-keys input.form-text');
      if (searchInput && !searchInput.getAttribute('placeholder')) {
        searchInput.setAttribute('placeholder', 'Search Resources');
      }

      var params = new URLSearchParams(window.location.search);
      var hasTypeParam = false;
      var hasCategoryParam = false;
      var hasQueryParam = false;

      params.forEach(function (value, key) {
        if (!value) return;
        if (key.indexOf('field_resource_type_target_id') === 0) hasTypeParam = true;
        if (key.indexOf('field_resource_categories_target_id') === 0) hasCategoryParam = true;
        if (key === 'keys') hasQueryParam = true;
      });

      filters.querySelectorAll('details').forEach(function (details) {
        details.removeAttribute('open');
      });

      if (hasTypeParam) {
        var typeInput = filters.querySelector('input[name*="field_resource_type_target_id"]');
        if (typeInput) {
          var typeDetails = typeInput.closest('details');
          if (typeDetails) typeDetails.setAttribute('open', 'open');
        }
      }

      if (hasCategoryParam) {
        var categoryInput = filters.querySelector('input[name*="field_resource_categories_target_id"]');
        if (categoryInput) {
          var categoryDetails = categoryInput.closest('details');
          if (categoryDetails) categoryDetails.setAttribute('open', 'open');
        }
      }

      if (hasTypeParam || hasCategoryParam || hasQueryParam) {
        filters.classList.add('has-active-filters');
      }
    });
  }

  Drupal.behaviors.resourceCardEnhancements = {
    attach: function (context) {
      once(
        'resourceCardEnhancements',
        [
          '.view[class*="view-resources"] article.resource',
          '.view[class*="view-guided-meditations"] article.resource',
          '.view-id-resources article.resource',
          '.view-id-guided_meditations article.resource'
        ].join(', '),
        context
      );
      enhanceResourceCards(context);
    }
  };

  Drupal.behaviors.resourceFilterUI = {
    attach: function (context) {
      once(
        'resourceFilterUI',
        [
          '.view[class*="view-resources"] .view-filters',
          '.view[class*="view-guided-meditations"] .view-filters',
          '.view-id-resources .view-filters',
          '.view-id-guided_meditations .view-filters'
        ].join(', '),
        context
      );
      enhanceResourceFilters(context);
    }
  };

  function ensureResourceBehaviorsRun() {
    try {
      enhanceResourceCards(document);
      enhanceResourceFilters(document);
      Drupal.behaviors.resourceCardEnhancements.attach(document);
      Drupal.behaviors.resourceFilterUI.attach(document);
    } catch (e) {
      // Defensive no-op: do not block other site behaviors if resource cards are absent.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureResourceBehaviorsRun, { once: true });
  } else {
    ensureResourceBehaviorsRun();
  }

  // Ensures new REACH card view modes still receive legacy `.profile-card` styling/hooks.
  Drupal.behaviors.reachProfileCardClassAdapter = {
    attach: function (context) {
      once(
        'reachProfileCardClassAdapter',
        '.view-reach-profiles-leadership article.profile, .view-reach-profiles-members article.profile, .view-id-reach_profiles_leadership article.profile, .view-id-reach_profiles_members article.profile, .profile-cards article.profile',
        context
      ).forEach(function (card) {
        if (!card.classList.contains('profile-card')) {
          card.classList.add('profile-card');
        }
      });
    }
  };

  // Adds a text-based placeholder when headshot images are missing/broken.
  Drupal.behaviors.reachProfileHeadshotPlaceholder = {
    attach: function (context) {
      once(
        'reachProfileCard',
        '.view-reach-profiles-leadership .profile-card, .view-reach-profiles-members .profile-card, .view-id-reach_profiles_leadership .profile-card, .view-id-reach_profiles_members .profile-card, .profile-cards .profile-card',
        context
      ).forEach(function (card) {
        var content = card.querySelector('.content') || card;
        var headshot = card.querySelector('.field--name-field-profile-headshot');

        if (!headshot) {
          headshot = document.createElement('div');
          headshot.className = 'field field--name-field-profile-headshot field__item';
          content.insertBefore(headshot, content.firstChild);
        }

        headshot.classList.add('reach-profile-headshot');

        var first = card.querySelector('.field--name-field-first-name');
        var last = card.querySelector('.field--name-field-last-name');
        var nameParts = [];
        var firstTextForLabel = readFieldText(first);
        var lastTextForLabel = readFieldText(last);
        if (firstTextForLabel) nameParts.push(firstTextForLabel);
        if (lastTextForLabel) nameParts.push(lastTextForLabel);
        var fallbackLabel = nameParts.join(' ');
        var emoji = '👤';

        function buildPlaceholder() {
          if (headshot.querySelector('.reach-profile-placeholder')) return;
          headshot.innerHTML = '';
          var placeholder = document.createElement('div');
          placeholder.className = 'reach-profile-placeholder';
          var emojiEl = document.createElement('span');
          emojiEl.className = 'reach-profile-placeholder-emoji';
          emojiEl.textContent = emoji;
          placeholder.appendChild(emojiEl);
          if (fallbackLabel) {
            placeholder.setAttribute('aria-label', fallbackLabel + ' headshot placeholder');
          }
          headshot.appendChild(placeholder);
        }

        var img = headshot.querySelector('img');
        if (img) {
          img.addEventListener('error', buildPlaceholder, { once: true });
          if (img.complete && img.naturalWidth === 0) {
            buildPlaceholder();
          }
        } else {
          buildPlaceholder();
        }
      });
    }
  };

  // Combines first/last/(optional credentials) into one display name on cards.
  Drupal.behaviors.reachProfileNameGlue = {
    attach: function (context) {
      once(
        'reachProfileNameGlue',
        '.view-reach-profiles-leadership .profile-card, .view-reach-profiles-members .profile-card, .view-id-reach_profiles_leadership .profile-card, .view-id-reach_profiles_members .profile-card, .profile-cards .profile-card',
        context
      ).forEach(function (card) {
        var first = card.querySelector('.field--name-field-first-name');
        var last = card.querySelector('.field--name-field-last-name');
        var creds = card.querySelector('.field--name-field-credentials-display');
        if (!last) return;

        if (last.parentElement && last.parentElement.classList.contains('reach-name-combined')) return;
        if (creds && creds.parentElement && creds.parentElement.classList.contains('reach-name-combined')) return;

        var firstText = first ? readFieldText(first) : '';
        var lastText = readFieldText(last).replace(/,+\s*$/, '');
        var credsText = creds ? readFieldText(creds).replace(/^,\s*/, '') : '';

        if (!firstText && !lastText) return;

        var parts = [];
        if (firstText) parts.push(firstText);
        if (lastText) {
          var lastPart = lastText;
          if (credsText) lastPart += ',';
          parts.push(lastPart);
        }
        if (credsText) parts.push(credsText);

        var combined = parts.join(' ');
        var wrap = document.createElement('span');
        wrap.className = 'reach-name-combined';
        wrap.textContent = combined;

        // Hide originals to avoid duplicate render while preserving text for lookups.
        [first, last, creds].forEach(function (node) {
          if (!node) return;
          node.setAttribute('aria-hidden', 'true');
          node.classList.add('reach-name-hidden');
          node.style.display = 'none';
        });

        var insertBeforeTarget = first || last || creds;
        if (insertBeforeTarget && insertBeforeTarget.parentNode) {
          insertBeforeTarget.parentNode.insertBefore(wrap, insertBeforeTarget);
        }
      });
    }
  };

  function buildReachDisplayName(first, last, creds) {
    var firstText = first ? readFieldText(first) : '';
    var lastText = last ? readFieldText(last).replace(/,+\s*$/, '') : '';
    var credsText = creds ? readFieldText(creds).replace(/^,\s*/, '') : '';

    if (!firstText && !lastText) return '';

    var parts = [];
    if (firstText) parts.push(firstText);
    if (lastText) {
      var lastPart = lastText;
      if (credsText) lastPart += ',';
      parts.push(lastPart);
    }
    if (credsText) parts.push(credsText);

    return parts.join(' ');
  }

  // Builds a profile hero text block and places display title + metadata in a fixed order.
  Drupal.behaviors.reachProfileFullDisplayTitle = {
    attach: function (context) {
      once('reachProfileFullDisplayTitle', '.page-node-type-profile article.profile.full', context)
        .forEach(function (article) {
          var content = article.querySelector('.content') || article;
          var headshot = content.querySelector('.field--name-field-profile-headshot');
          var heroText = content.querySelector('.reach-profile-hero-text');
          var roles = article.querySelector('.field--name-field-reach-roles');
          var titles = article.querySelector('.field--name-field-titles');
          var research = article.querySelector('.field--name-field-research-areas');
          var profileLink = article.querySelector('.field--name-field-profile-link');
          var identitySection = article.querySelector('.profile-hero .profile-identity');
          var researchSection = article.querySelector('.profile-section--research');
          var researchAffiliations = researchSection && researchSection.querySelector('.profile-section__affiliations');
          var first = article.querySelector('.field--name-field-first-name');
          var last = article.querySelector('.field--name-field-last-name');
          var creds = article.querySelector('.field--name-field-credentials-display');

          var displayName = buildReachDisplayName(first, last, creds);
          if (!displayName) return;

          var displayTitle = content.querySelector('.reach-profile-display-title');
          if (!displayTitle) {
            displayTitle = document.createElement('h1');
            displayTitle.className = 'reach-profile-display-title heading--h2-alt';
          }
          displayTitle.textContent = displayName;

          if (!heroText) {
            heroText = document.createElement('div');
            heroText.className = 'reach-profile-hero-text';
            if (headshot && headshot.parentNode === content) {
              if (headshot.nextSibling) {
                content.insertBefore(heroText, headshot.nextSibling);
              } else {
                content.appendChild(heroText);
              }
            } else if (content.firstChild) {
              content.insertBefore(heroText, content.firstChild);
            } else {
              content.appendChild(heroText);
            }
          }

          [first, last, creds].forEach(function (node) {
            if (!node) return;
            node.setAttribute('aria-hidden', 'true');
            node.classList.add('reach-name-hidden');
            node.style.display = 'none';
          });

          if (displayTitle.parentNode !== heroText) {
            heroText.insertBefore(displayTitle, heroText.firstChild);
          }

          if (identitySection) {
            if (identitySection.parentNode !== heroText) {
              heroText.appendChild(identitySection);
            }

            if (titles) {
              var firstVisibleIdentityChild = null;
              Array.prototype.forEach.call(identitySection.children, function (child) {
                if (firstVisibleIdentityChild || child.classList.contains('reach-name-hidden')) return;
                firstVisibleIdentityChild = child;
              });
              if (firstVisibleIdentityChild) {
                identitySection.insertBefore(titles, firstVisibleIdentityChild);
              } else {
                identitySection.appendChild(titles);
              }
            }

          } else {
            if (titles) {
              heroText.appendChild(titles);
            }
          }

          if (researchSection) {
            if (!researchAffiliations) {
              researchAffiliations = document.createElement('div');
              researchAffiliations.className = 'profile-section__affiliations';
              researchSection.appendChild(researchAffiliations);
            }

            var hasReachRoles = !!(roles && readFieldText(roles));
            var badge = researchSection.querySelector('.reach-profile-research-badge');
            if (hasReachRoles) {
              if (!badge) {
                badge = document.createElement('span');
                badge.className = 'reach-profile-research-badge';
                badge.textContent = 'REACH';
              }
              if (badge.parentNode !== researchAffiliations) {
                researchAffiliations.insertBefore(badge, researchAffiliations.firstChild);
              }
            } else if (badge && badge.parentNode) {
              badge.parentNode.removeChild(badge);
            }

            [roles, research, profileLink].forEach(function (field) {
              if (!field) return;
              researchAffiliations.appendChild(field);
            });
          } else {
            [roles, research, profileLink].forEach(function (field) {
              if (!field) return;
              heroText.appendChild(field);
            });
          }
        });
    }
  };

  // Hides the new profile research section only when it has no actual content.
  Drupal.behaviors.reachProfileResearchSectionVisibility = {
    attach: function (context) {
      once(
        'reachProfileResearchSectionVisibility',
        '.page-node-type-profile article.profile.full .profile-section--research',
        context
      ).forEach(function (section) {
        var affiliations = section.querySelector('.profile-section__affiliations');
        var text = affiliations ? (affiliations.textContent || '').replace(/\s+/g, ' ').trim() : '';
        var hasLinks = !!(affiliations && affiliations.querySelector('a'));
        var hasContent = !!(text || hasLinks);

        if (!hasContent) {
          section.setAttribute('aria-hidden', 'true');
          section.style.display = 'none';
          return;
        }

        section.style.removeProperty('display');
        section.removeAttribute('aria-hidden');
      });
    }
  };

  // Moves institution pill into headshot container so it overlays with inset spacing.
  function findProfileInstitutionField(card) {
    if (!card) return null;
    var affiliation = card.querySelector('.field--name-field-institution-affiliation');
    if (affiliation) return { node: affiliation, isAffiliation: true };
    var legacy = card.querySelector('.field--name-field-institution');
    if (legacy) return { node: legacy, isAffiliation: false };
    return null;
  }

  function readInstitutionAbbreviation(field) {
    if (!field) return '';
    var target = field.querySelector('a') || field;
    var candidates = [field, target];
    var attrs = [
      'data-abbreviation',
      'data-abbrev',
      'data-abbr',
      'data-term-abbreviation',
      'data-term-abbrev',
      'data-term-abbr'
    ];

    var selector = attrs.map(function (attr) {
      return '[' + attr + ']';
    }).join(',');
    var dataNodes = selector ? field.querySelectorAll(selector) : [];
    dataNodes.forEach(function (node) {
      candidates.push(node);
    });

    for (var i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (!node) continue;
      for (var j = 0; j < attrs.length; j++) {
        var val = node.getAttribute(attrs[j]);
        if (val && val.trim()) return val.trim();
      }
    }

    var abbrNodes = field.querySelectorAll(
      [
        '.field--name-field-abbreviation',
        '.field--name-field-abbrev',
        '.field--name-field-abbr',
        '.field--name-field-abbreviation .field__item',
        '.field--name-field-abbrev .field__item',
        '.field--name-field-abbr .field__item',
        '[class*="field--name-field-"][class*="abbrev"]',
        '[class*="field--name-field-"][class*="abbr"]',
        '[class*="field--name-field-"][class*="abbrev"] .field__item',
        '[class*="field--name-field-"][class*="abbr"] .field__item',
        'abbr'
      ].join(',')
    );
    for (var k = 0; k < abbrNodes.length; k++) {
      var abbrText = (abbrNodes[k].textContent || '').trim();
      if (abbrText) return abbrText;
    }

    return '';
  }

  function readInstitutionName(field) {
    if (!field) return '';
    var link = field.querySelector('a');
    if (link) {
      var linkText = (link.textContent || '').trim();
      if (linkText) return linkText;
    }

    var heading = field.querySelector('h2, h3');
    if (heading) {
      var headingText = (heading.textContent || '').trim();
      if (headingText) return headingText;

      var headingTitle = heading.getAttribute('title');
      if (headingTitle && headingTitle.trim()) return headingTitle.trim();

      var titledChild = heading.querySelector('[title]');
      if (titledChild) {
        var innerTitle = titledChild.getAttribute('title');
        if (innerTitle && innerTitle.trim()) return innerTitle.trim();
      }
    }

    var titled = field.querySelector('[data-name], [data-term-name], [title]');
    if (titled) {
      var value =
        titled.getAttribute('data-name') ||
        titled.getAttribute('data-term-name') ||
        titled.getAttribute('title') ||
        '';
      if (value && value.trim()) return value.trim();
    }

    var labelAttrs = ['aria-label', 'data-label', 'data-entity-label', 'data-drupal-entity-label'];
    var labelTargets = [field];
    if (link) labelTargets.push(link);
    field.querySelectorAll(
      labelAttrs
        .map(function (attr) {
          return '[' + attr + ']';
        })
        .join(',')
    ).forEach(function (node) {
      labelTargets.push(node);
    });

    for (var i = 0; i < labelTargets.length; i++) {
      var node = labelTargets[i];
      if (!node) continue;
      for (var j = 0; j < labelAttrs.length; j++) {
        var attrVal = node.getAttribute(labelAttrs[j]);
        if (attrVal && attrVal.trim()) return attrVal.trim();
      }
    }

    return readFieldText(field);
  }

  function copyDataAttributes(source, target) {
    if (!source || !target || !source.attributes) return;
    Array.prototype.forEach.call(source.attributes, function (attr) {
      if (attr.name && attr.name.indexOf('data-') === 0) {
        target.setAttribute(attr.name, attr.value);
      }
    });
  }

  function applyInstitutionLabel(field) {
    if (!field) return '';
    var name = readInstitutionName(field);
    var abbreviation = readInstitutionAbbreviation(field);
    var existingLabelNode = field.querySelector('.reach-institution-pill-label');
    var heading = field.querySelector('h2, h3, h4, h5, h6');
    var labelClass = (existingLabelNode && existingLabelNode.className) || 'reach-institution-pill-label';
    var labelSpan = existingLabelNode && existingLabelNode.tagName.toLowerCase() === 'span' ? existingLabelNode : null;
    var link = field.querySelector('a');
    var existingLabel = (existingLabelNode && existingLabelNode.textContent ? existingLabelNode.textContent : '').trim();
    var existing = (existingLabel || readFieldText(field) || '').trim();
    var finalLabel = abbreviation || name || existingLabel || existing;
    if (!finalLabel) return '';

    if (!labelSpan) {
      labelSpan = document.createElement('span');
    }
    labelSpan.className = labelClass || 'reach-institution-pill-label';

    // Move label into the field root so it is not hidden by profile card heading styles.
    if (labelSpan.parentNode !== field) {
      if (field.firstChild) {
        field.insertBefore(labelSpan, field.firstChild);
      } else {
        field.appendChild(labelSpan);
      }
    }
    if (heading) {
      heading.setAttribute('aria-hidden', 'true');
      heading.style.display = 'none';
    }

    // Replace link with plain text to avoid hyperlink in the pill, preserving attributes.
    if (link && link.parentNode) {
      copyDataAttributes(link, labelSpan);
      var linkTitle = link.getAttribute('title') || existing;
      var tooltip = abbreviation && name && name !== abbreviation ? name : linkTitle;
      if (tooltip && !labelSpan.getAttribute('title')) {
        labelSpan.setAttribute('title', tooltip);
      }
      link.parentNode.removeChild(link);
    } else if (!labelSpan.parentNode) {
      var title = abbreviation && name && name !== abbreviation ? name : '';
      if (title && !labelSpan.getAttribute('title')) {
        labelSpan.setAttribute('title', title);
      }
      field.appendChild(labelSpan);
    }

    // Always provide full institution name as hover helper when available.
    var hoverTitle = name || finalLabel;
    if (hoverTitle) {
      labelSpan.setAttribute('title', hoverTitle);
      if (!field.getAttribute('title') || field.getAttribute('title') !== hoverTitle) {
        field.setAttribute('title', hoverTitle);
      }
    }

    labelSpan.textContent = finalLabel;
    labelSpan.style.textIndent = '0';
    labelSpan.style.display = 'inline';
    labelSpan.style.visibility = 'visible';
    labelSpan.style.opacity = '1';
    labelSpan.removeAttribute('aria-hidden');

    return finalLabel;
  }

  Drupal.behaviors.reachProfileInstitutionOverlay = {
    attach: function (context) {
      once(
        'reachProfileInstitutionOverlay',
        '.view-reach-profiles-leadership .profile-card, .view-reach-profiles-members .profile-card, .view-id-reach_profiles_leadership .profile-card, .view-id-reach_profiles_members .profile-card, .profile-cards .profile-card',
        context
      ).forEach(function (card) {
        var headshot = card.querySelector('.field--name-field-profile-headshot');
        var selection = findProfileInstitutionField(card);
        if (!headshot || !selection) return;

        var institution = selection.node;
        var legacy = card.querySelector('.field--name-field-institution');
        var chosen = institution;

        var label = applyInstitutionLabel(chosen);
        if (!label && legacy && legacy !== institution) {
          label = applyInstitutionLabel(legacy);
          if (label) {
            chosen = legacy;
          }
        }
        if (!label) return;

        if (legacy && legacy !== chosen) {
          legacy.setAttribute('aria-hidden', 'true');
          legacy.style.display = 'none';
        }

        if (institution && institution !== chosen) {
          institution.setAttribute('aria-hidden', 'true');
          institution.style.display = 'none';
        }

        if (chosen.parentNode !== headshot) {
          headshot.appendChild(chosen);
        }
      });
    }
  };

  // Fallback: ensure the overlay behavior runs even if Drupal never attaches.
  function ensureInstitutionOverlayRuns() {
    try {
      Drupal.behaviors.reachProfileInstitutionOverlay.attach(document);
    } catch (e) {
      // Swallow to avoid blocking other scripts; this is a defensive helper.
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureInstitutionOverlayRuns, { once: true });
  } else {
    ensureInstitutionOverlayRuns();
  }

  // Forces profile card CTA links to use the local Drupal entity URL.
  Drupal.behaviors.reachProfileLinkLabel = {
    attach: function (context) {
      once(
        'reachProfileLinkLabel',
        '.view-reach-profiles-leadership .profile-card, .view-reach-profiles-members .profile-card, .view-id-reach_profiles_leadership .profile-card, .view-id-reach_profiles_members .profile-card, .profile-cards .profile-card',
        context
      ).forEach(function (card) {
        var titleLink = card.querySelector('h2 a[href]');
        if (!titleLink) return;

        var localHref = (titleLink.getAttribute('href') || '').trim();
        if (!localHref) return;

        var link = card.querySelector('.field--name-field-profile-link a');
        if (!link) return;

        var original = (link.textContent || '').trim();
        if (original && original.toLowerCase() !== 'view profile') {
          link.setAttribute('data-original-url', original);
        }

        link.setAttribute('href', localHref);
        link.removeAttribute('target');
        link.removeAttribute('rel');
        link.textContent = 'View Profile';
      });
    }
  };

  // Ensures Instructor profile cards link to the local profile page view.
  Drupal.behaviors.instructorCardProfileLink = {
    attach: function (context) {
      once(
        'instructorCardProfileLink',
        '.view-id-profiles_cards .profile-card, .view-profiles-cards .profile-card',
        context
      ).forEach(function (card) {
        var titleLink = card.querySelector('h2 a');
        if (!titleLink) return;

        var href = titleLink.getAttribute('href') || '';
        if (!href) return;

        var profileLink = card.querySelector('.field--name-field-profile-link a');

        if (!profileLink) {
          var container = card.querySelector('.field--name-field-profile-link');
          if (!container) {
            container = document.createElement('div');
            container.className = 'field field--name-field-profile-link';
            var anchor = document.createElement('a');
            anchor.className = 'instructor-view-profile';
            anchor.href = href;
            anchor.textContent = 'View Profile';
            container.appendChild(anchor);

            var content = card.querySelector('.content') || card;
            var shortBio = content.querySelector('.field--name-field-short-bio');
            if (shortBio && shortBio.nextSibling) {
              content.insertBefore(container, shortBio.nextSibling);
            } else {
              content.appendChild(container);
            }
            return;
          }
          profileLink = container.querySelector('a');
          if (!profileLink) return;
        }

        profileLink.setAttribute('href', href);
        profileLink.removeAttribute('target');
        profileLink.removeAttribute('rel');
        profileLink.textContent = 'View Profile';
      });
    }
  };

  // Hides "Leadership" role tag from profile cards while keeping other roles.
  Drupal.behaviors.reachProfileRoleFilter = {
    attach: function (context) {
      try {
        once('reachProfileRoleFilter', '.profile-card .field--name-field-reach-roles', context).forEach(function (field) {
          if (!field || !field.querySelectorAll) return;

          var items = Array.prototype.slice.call(field.querySelectorAll('.field__item'));
          if (!items.length) return;

          var visibleCount = 0;

          items.forEach(function (item) {
            var text = (item.textContent || '').trim().toLowerCase();
            if (text === 'leadership') {
              item.setAttribute('aria-hidden', 'true');
              item.style.display = 'none';
            } else {
              visibleCount++;
            }
          });

          if (visibleCount === 0) {
            field.setAttribute('aria-hidden', 'true');
            field.style.display = 'none';
          }
        });
      } catch (e) {
        // Fail silently to avoid blocking Drupal behaviors or view rendering.
      }
    }
  };

  // Hides "Leadership" role on full profile pages while keeping other role values.
  Drupal.behaviors.reachProfileFullRoleFilter = {
    attach: function (context) {
      once('reachProfileFullRoleFilter', '.page-node-type-profile article.profile.full .field--name-field-reach-roles', context)
        .forEach(function (field) {
          var items = Array.prototype.slice.call(field.querySelectorAll('.field__item'));
          if (!items.length) return;

          items.forEach(function (item) {
            var text = (item.textContent || '').trim().toLowerCase();
            if (text === 'leadership' && item.parentNode) {
              item.parentNode.removeChild(item);
            }
          });

          if (!field.querySelector('.field__item')) {
            field.setAttribute('aria-hidden', 'true');
            field.style.display = 'none';
          }
        });
    }
  };

  // Groups REACH committee members by role and normalizes committee headings.
  Drupal.behaviors.reachCommitteeViewEnhancements = {
    attach: function (context) {
      once(
        'reachCommitteeViewEnhancements',
        '.view-reach-profiles-committees, .view-id-reach_profiles_committees',
        context
      ).forEach(function (view) {
        var viewContent = view.querySelector('.view-content');
        if (!viewContent) return;

        var children = Array.prototype.slice.call(viewContent.children || []);
        var sections = [];
        var currentSection = null;

        children.forEach(function (child) {
          if (!child) return;

          if (child.tagName && child.tagName.toLowerCase() === 'h3') {
            currentSection = {
              heading: child,
              rows: []
            };
            sections.push(currentSection);
            return;
          }

          if (currentSection && child.classList && child.classList.contains('views-row')) {
            currentSection.rows.push(child);
          }
        });

        sections.forEach(function (section) {
          if (!section.heading) return;

          var heading = section.heading;
          if (heading.tagName.toLowerCase() !== 'h4') {
            heading = promoteHeading(heading, 'h4');
            section.heading = heading;
          }

          var insertAfterNode = heading;

          var grouped = {
            lead: [],
            member: []
          };

          section.rows.forEach(function (row) {
            var content = row.querySelector('.views-field-field-role .field-content');
            if (!content) {
              row.remove();
              return;
            }

            var link = content.querySelector('a[href]');
            var rawText = (content.textContent || '').replace(/\s+/g, ' ').trim();
            var match = rawText.match(/^([^:]+):\s*(.*)$/);
            var roleText = match && match[1] ? match[1].trim().toLowerCase() : '';
            var nameText = match && match[2] ? match[2].trim() : rawText;
            var bucket = roleText === 'lead' ? grouped.lead : roleText === 'member' ? grouped.member : null;

            if (bucket && nameText) {
              bucket.push({
                link: link ? link.cloneNode(true) : null,
                text: nameText
              });
            }

            row.remove();
          });

          ['lead', 'member'].forEach(function (roleKey) {
            if (!grouped[roleKey].length) return;

            var line = document.createElement('p');
            line.className = 'committee-role-line committee-role-line--' + roleKey;

            var label = document.createElement('span');
            label.className = 'committee-role-label';
            label.textContent = roleKey === 'lead' ? 'Leads:' : 'Members:';
            line.appendChild(label);
            line.appendChild(document.createTextNode(' '));

            grouped[roleKey].forEach(function (person, index) {
              if (index > 0) {
                line.appendChild(document.createTextNode(', '));
              }

              if (person.link) {
                person.link.textContent = person.text;
                line.appendChild(person.link);
              } else {
                line.appendChild(document.createTextNode(person.text));
              }
            });

            if (insertAfterNode.nextSibling) {
              insertAfterNode.parentNode.insertBefore(line, insertAfterNode.nextSibling);
            } else {
              insertAfterNode.parentNode.appendChild(line);
            }

            insertAfterNode = line;
          });
        });

        view.classList.add('is-committee-enhanced');
      });
    }
  };

  // Program instructor layout handled by dedicated view mode; no DOM surgery here.

  function normalizeDateText(value) {
    return (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function getFieldDateValue(field) {
    if (!field) return '';

    var timeNode = field.querySelector('time[datetime]');
    if (timeNode) {
      return (timeNode.getAttribute('datetime') || '').trim();
    }

    var item = field.querySelector('.field__item');
    return normalizeDateText(item ? item.textContent : field.textContent);
  }

  function parseDateValue(value) {
    if (!value) return null;
    // ISO date-only strings (YYYY-MM-DD) are UTC midnight in spec — force local noon
    // to prevent the date rolling back one day for US timezones.
    var isoDate = value.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (isoDate) {
      var parsed = new Date(isoDate[1] + 'T12:00:00');
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function orderDatePair(startValue, endValue) {
    var startDate = parseDateValue(startValue);
    var endDate = parseDateValue(endValue);

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      return {
        startValue: endValue,
        endValue: startValue,
        startDate: endDate,
        endDate: startDate
      };
    }

    return {
      startValue: startValue,
      endValue: endValue,
      startDate: startDate,
      endDate: endDate
    };
  }

  function getDatePairFromFields(root, options) {
    if (!root || !options) return null;

    var combinedField = options.combinedSelector ? root.querySelector(options.combinedSelector) : null;
    if (combinedField) {
      var items = combinedField.querySelectorAll('.field__item');
      if (items.length >= 2) {
        var combinedStart = getFieldDateValue(items[0]);
        var combinedEnd = getFieldDateValue(items[1]);
        if (combinedStart && combinedEnd) {
          return {
            type: 'combined',
            container: combinedField,
            startField: items[0],
            endField: items[1],
            values: orderDatePair(combinedStart, combinedEnd)
          };
        }
      }
    }

    var startField = options.startSelector ? root.querySelector(options.startSelector) : null;
    var endField = options.endSelector ? root.querySelector(options.endSelector) : null;
    var startValue = getFieldDateValue(startField);
    var endValue = getFieldDateValue(endField);

    if (!startField || !endField || !startValue || !endValue) return null;

    return {
      type: 'separate',
      container: startField,
      startField: startField,
      endField: endField,
      values: orderDatePair(startValue, endValue)
    };
  }

  function formatDateRangeText(startValue, endValue, startDate, endDate) {
    if (startDate && endDate) {
      var sameYear = startDate.getFullYear() === endDate.getFullYear();
      var startOptions = { month: 'long', day: 'numeric' };
      var endOptions = { month: 'long', day: 'numeric', year: 'numeric' };

      if (!sameYear) {
        startOptions.year = 'numeric';
      }

      return startDate.toLocaleDateString('en-US', startOptions) + ' – ' +
        endDate.toLocaleDateString('en-US', endOptions);
    }

    var normalizedStart = normalizeDateText(startValue);
    var normalizedEnd = normalizeDateText(endValue);
    var startParts = normalizedStart.split(/\s*[–-]\s*/);
    if (startParts.length >= 1) {
      normalizedStart = startParts[0].trim();
    }

    var startYearMatch = normalizedStart.match(/(\d{4})/);
    var endYearMatch = normalizedEnd.match(/(\d{4})/);
    if (startYearMatch && endYearMatch && startYearMatch[1] === endYearMatch[1]) {
      normalizedStart = normalizedStart.replace(/,\s*\d{4}\s*$/, '');
    }

    return normalizedStart + ' – ' + normalizedEnd;
  }

  // Injects "View Profile" link after short bio using the profile title link.
  Drupal.behaviors.programInstructorProfileLink = {
    attach: function (context) {
      once(
        'programInstructorProfileLink',
        '.page-node-type-program .field--name-field-instructors article.profile.inline-instructor',
        context
      ).forEach(function (article) {
        if (article.getAttribute('data-program-profile-link') === '1') return;
        article.setAttribute('data-program-profile-link', '1');

        var titleLink = article.querySelector('h2 a');
        if (!titleLink) return;

        var bioParagraph = article.querySelector('.field--name-field-short-bio .field__item p');
        if (!bioParagraph) return;

        var existing = bioParagraph.querySelector('.program-view-profile');
        if (!existing) {
          var link = document.createElement('a');
          link.className = 'program-view-profile';
          link.href = titleLink.getAttribute('href') || '#';
          link.textContent = 'View Profile';
          bioParagraph.appendChild(document.createTextNode(' '));
          bioParagraph.appendChild(link);
        }

        if (titleLink.parentNode) {
          titleLink.parentNode.style.display = 'none';
        }
      });
    }
  };

  // Normalizes program sidebar CTA labels so URLs never render as button text.
  Drupal.behaviors.programSidebarCtaLabels = {
    attach: function (context) {
      once('programSidebarCtaLabels', '.page-node-type-program .group-program-sidebar', context)
        .forEach(function (sidebar) {
          var registration = sidebar.querySelector('.field--name-field-registration-link a');
          if (registration) {
            var regOriginal = (registration.textContent || '').trim();
            if (regOriginal && regOriginal.toLowerCase() !== 'register here') {
              registration.setAttribute('data-original-url', regOriginal);
            }
            registration.textContent = 'Register Here';
          }

          var subscribe = sidebar.querySelector('.field--name-field-subscribe-link a');
          if (subscribe) {
            var subOriginal = (subscribe.textContent || '').trim();
            if (subOriginal && subOriginal.toLowerCase() !== 'subscribe for updates') {
              subscribe.setAttribute('data-original-url', subOriginal);
            }
            subscribe.textContent = 'Subscribe for Updates';
          }
        });
    }
  };

  // Renders current session data in the Program page sidebar, replacing raw paragraph output.
  // Always shows a "Current Sessions" heading. The first currently open session gets the primary CTA button,
  // subsequent open sessions render as text links. If no sessions are currently open, the existing fallback
  // message and Subscribe CTA are used instead.
  Drupal.behaviors.programSidebarSessionEnhancements = {
    attach: function (context) {
      once('programSidebarSessionEnhancements', '.page-node-type-program .group-program-sidebar', context)
        .forEach(function (sidebar) {
          var sessionField = sidebar.querySelector('.field--name-field-program-session');
          if (!sessionField) return;

          var sessionItems = Array.prototype.slice.call(
            sessionField.querySelectorAll('.field__items > .field__item')
          );
          if (!sessionItems.length) return;

          // Extract data from each session paragraph.
          var sessions = [];
          sessionItems.forEach(function (item) {
            var startEl = item.querySelector('.field--name-field-session-start-date time[datetime]');
            var endEl = item.querySelector('.field--name-field-session-end-date time[datetime]');
            var regLinkEl = item.querySelector('.field--name-field-registration-link a[href]');
            var formatLinkEl = item.querySelector('.field--name-field-program-format a');
            var locationEl = item.querySelector('.field--name-field-location .field__item');

            var rangeText = '';
            if (startEl && endEl) {
              var ordered = orderDatePair(
                startEl.getAttribute('datetime') || '',
                endEl.getAttribute('datetime') || ''
              );
              rangeText = formatDateRangeText(
                ordered.startValue, ordered.endValue,
                ordered.startDate, ordered.endDate
              );
            }

            // For In Person sessions, show the actual address; otherwise use the format term label.
            var locationText = '';
            var formatHref = formatLinkEl ? (formatLinkEl.getAttribute('href') || '') : '';
            var isInPersonSession = formatHref.endsWith('/114');
            if (isInPersonSession && locationEl) {
              locationText = (locationEl.textContent || '').trim();
            } else if (formatLinkEl) {
              locationText = (formatLinkEl.textContent || '').trim();
            } else if (locationEl) {
              locationText = (locationEl.textContent || '').trim();
            }

            var registrationPair = getDatePairFromFields(item, {
              combinedSelector: '.field--name-field-registration-dates',
              startSelector: '.field--name-field-registration-start-date',
              endSelector: '.field--name-field-registration-end-date'
            });
            var registrationStart = registrationPair && registrationPair.values
              ? registrationPair.values.startDate
              : null;
            var registrationEnd = registrationPair && registrationPair.values
              ? registrationPair.values.endDate
              : null;
            var isCurrent = false;

            if (regLinkEl) {
              if (registrationStart && registrationEnd) {
                var nowTime = new Date().getTime();
                isCurrent = nowTime >= registrationStart.getTime() && nowTime <= registrationEnd.getTime();
              } else {
                isCurrent = true;
              }
            }

            var instructorEls = item.querySelectorAll('.field--name-field-instructors .field--name-title');
            var instructors = [];
            Array.prototype.forEach.call(instructorEls, function (titleEl) {
              var linkEl = titleEl.closest('article') && titleEl.closest('article').querySelector('h2 a');
              instructors.push({
                name: (titleEl.textContent || '').trim(),
                href: linkEl ? (linkEl.getAttribute('href') || '') : ''
              });
            });

            sessions.push({
              rangeText: rangeText,
              locationText: locationText,
              regHref: regLinkEl ? (regLinkEl.getAttribute('href') || '').trim() : '',
              isCurrent: isCurrent,
              instructors: instructors
            });
          });

          var currentSessions = sessions.filter(function (session) {
            return session.isCurrent;
          });

          var sessionHeading = document.createElement('h5');
          sessionHeading.className = 'program-sidebar__session-heading';
          sessionHeading.textContent = 'Current Sessions';

          var listEl = document.createElement('div');
          listEl.className = 'program-sidebar__session-list';

          currentSessions.forEach(function (session, index) {
            var itemEl = document.createElement('div');
            itemEl.className = 'program-sidebar__session-item';

            if (session.rangeText) {
              var datesEl = document.createElement('p');
              datesEl.className = 'program-sidebar__session-dates';
              datesEl.textContent = session.rangeText;
              itemEl.appendChild(datesEl);
            }

            if (session.locationText) {
              var locEl = document.createElement('p');
              locEl.className = 'program-sidebar__session-location';
              locEl.textContent = 'Location: ' + session.locationText;
              itemEl.appendChild(locEl);
            }

            if (session.instructors && session.instructors.length) {
              var instrEl = document.createElement('p');
              instrEl.className = 'program-sidebar__session-instructor';
              instrEl.appendChild(document.createTextNode('Instructor: '));
              session.instructors.forEach(function (instr, i) {
                if (i > 0) instrEl.appendChild(document.createTextNode(', '));
                if (instr.href) {
                  var instrLink = document.createElement('a');
                  instrLink.href = instr.href;
                  instrLink.textContent = instr.name;
                  instrEl.appendChild(instrLink);
                } else {
                  instrEl.appendChild(document.createTextNode(instr.name));
                }
              });
              itemEl.appendChild(instrEl);
            }

            if (session.regHref) {
              var regEl = document.createElement('a');
              regEl.className = index === 0
                ? 'program-sidebar__session-register program-sidebar__session-register--primary'
                : 'program-sidebar__session-register';
              regEl.href = session.regHref;
              regEl.textContent = 'Register Here';
              regEl.setAttribute('target', '_blank');
              regEl.setAttribute('rel', 'noopener noreferrer');
              itemEl.appendChild(regEl);
            }

            listEl.appendChild(itemEl);
          });

          // Keep the sidebar aligned to Drupal display order: Price, Pricing Details, then sessions.
          var priceField = sidebar.querySelector('.field--name-field-price');
          var pricingField = sidebar.querySelector('.field--name-field-pricing-details');

          if (priceField) {
            sidebar.insertBefore(priceField, sidebar.firstChild);
          }

          if (pricingField) {
            sidebar.insertBefore(pricingField, priceField ? priceField.nextSibling : sidebar.firstChild);
          }

          var sessionAnchor = pricingField
            ? pricingField.nextSibling
            : (priceField ? priceField.nextSibling : sidebar.firstChild);

          if (currentSessions.length) {
            sidebar.insertBefore(sessionHeading, sessionAnchor);
            sidebar.classList.add('has-current-sessions');
            sidebar.classList.remove('has-no-current-sessions');
            sidebar.insertBefore(listEl, sessionHeading.nextSibling);
          } else {
            sidebar.classList.add('has-no-current-sessions');
            sidebar.classList.remove('has-current-sessions');
          }

          sidebar.setAttribute('data-current-session-count', String(currentSessions.length));

          // Always hide the raw session paragraph field after extracting its data.
          sessionField.style.display = 'none';
        });
    }
  };

  // Forces program profile links to show "View Profile" text.
  Drupal.behaviors.programProfileLinkLabel = {
    attach: function (context) {
      function normalizeLink(link) {
        if (!link) return;
        var original = (link.textContent || '').trim();
        if (original && original.toLowerCase() !== 'view profile') {
          link.setAttribute('data-original-url', original);
        }
        link.textContent = 'View Profile';
      }

      once('programProfileLinkLabel', '.page-node-type-program .field--name-field-profile-link a', context)
        .forEach(normalizeLink);
    }
  };

  // Ensures program contact email is clickable and prefixed/suffixed copy matches.
  Drupal.behaviors.programContactEmailLink = {
    attach: function (context) {
      once('programContactEmailLink', '.page-node-type-program .field--name-field-contact-email .field__item', context)
        .forEach(function (item) {
          var email = (item.textContent || '').trim();
          if (!email) return;
          item.innerHTML = 'Email <a href="mailto:' + email + '">' + email + '</a> for more information.';
        });
    }
  };

  function promoteHeading(node, tagName, textOverride) {
    if (!node || !node.parentNode) return null;
    var headingTag = (tagName || 'h3').toLowerCase();
    var headingNode = document.createElement(headingTag);
    Array.prototype.forEach.call(node.attributes || [], function (attr) {
      headingNode.setAttribute(attr.name, attr.value);
    });
    headingNode.textContent = typeof textOverride === 'string' ? textOverride : (node.textContent || '').trim();
    node.parentNode.replaceChild(headingNode, node);
    return headingNode;
  }

  // Uses semantic heading levels for key Program body sections.
  Drupal.behaviors.programBodyHeadingLevels = {
    attach: function (context) {
      once('programBodyHeadingLevels', '.page-node-type-program .group-program-body', context)
        .forEach(function (body) {
          var labelMappings = [
            { selector: '.field--name-body > .field__label', text: 'Program Overview', tag: 'h3' },
            { selector: '.field--name-field-continuing-education > .field__label', tag: 'h4' },
            { selector: '.field--name-field-cancellation-policy > .field__label', tag: 'h4' },
            { selector: '.field--name-field-contact-email > .field__label', text: 'Questions', tag: 'h4' }
          ];

          labelMappings.forEach(function (mapping) {
            var label = body.querySelector(mapping.selector);
            if (!label) return;
            var targetTag = (mapping.tag || 'h3').toLowerCase();
            if (label.tagName && label.tagName.toLowerCase() === targetTag) {
              if (typeof mapping.text === 'string') {
                label.textContent = mapping.text;
              }
              return;
            }
            promoteHeading(label, targetTag, mapping.text);
          });

          var instructorsField = body.querySelector('.field--name-field-instructors');
          if (instructorsField) {
            var heading = instructorsField.previousElementSibling;
            if (!heading || !heading.classList.contains('program-section-heading') || heading.getAttribute('data-program-heading-for') !== 'instructors') {
              heading = document.createElement('h4');
              heading.className = 'program-section-heading';
              heading.setAttribute('data-program-heading-for', 'instructors');
              heading.textContent = 'About the Instructor';
              instructorsField.parentNode.insertBefore(heading, instructorsField);
            } else if (heading.tagName && heading.tagName.toLowerCase() !== 'h4') {
              heading = promoteHeading(heading, 'h4');
              heading.classList.add('program-section-heading');
              heading.setAttribute('data-program-heading-for', 'instructors');
              heading.textContent = 'About the Instructor';
            }
          }
        });
    }
  };

  // Formats program event dates as a single range line.
  Drupal.behaviors.programEventDateRange = {
    attach: function (context) {
      once(
        'programEventDateRangeV5',
        '.page-node-type-program .field--name-field-event-dates, .page-node-type-program .field--name-field-program-start-date, .view-programs-cfm .field--name-field-event-dates, .view-programs-cfm .field--name-field-program-start-date, .view-id-programs_cfm .field--name-field-event-dates, .view-id-programs_cfm .field--name-field-program-start-date',
        context
      )
        .forEach(function (field) {
          var root = field.parentNode || field;
          var pair = getDatePairFromFields(root, {
            combinedSelector: '.field--name-field-event-dates',
            startSelector: '.field--name-field-program-start-date',
            endSelector: '.field--name-field-program-end-date'
          });
          if (!pair) return;

          var rangeText = formatDateRangeText(
            pair.values.startValue,
            pair.values.endValue,
            pair.values.startDate,
            pair.values.endDate
          );

          if (pair.type === 'combined') {
            pair.startField.textContent = rangeText;
            for (var i = 1; i < pair.container.querySelectorAll('.field__item').length; i += 1) {
              pair.container.querySelectorAll('.field__item')[i].style.display = 'none';
            }
          } else {
            var startItem = pair.startField.querySelector('.field__item') || pair.startField;
            startItem.textContent = rangeText;
            pair.startField.classList.add('program-date-range-field');
            pair.endField.style.display = 'none';
          }
        });
    }
  };

  // Adds a Study-card style "Learn More" CTA to each Programs view card.
  Drupal.behaviors.programCardsLearnMoreCta = {
    attach: function (context) {
      once('programCardsLearnMoreCta', '.view-programs-cfm article.program-card', context)
        .forEach(function (card) {
          var titleLink = card.querySelector('h2 a[href]');
          if (!titleLink) return;

          var href = titleLink.getAttribute('href') || '';
          if (!href) return;

          var ctaWrap = card.querySelector('.program-card__cta');
          if (!ctaWrap) {
            ctaWrap = document.createElement('div');
            ctaWrap.className = 'program-card__cta';
          }

          var ctaLink = ctaWrap.querySelector('a');
          if (!ctaLink) {
            ctaLink = document.createElement('a');
            ctaLink.className = 'btn btn-secondary btn-inline';
            ctaWrap.appendChild(ctaLink);
          }

          ctaLink.setAttribute('href', href);
          ctaLink.textContent = 'Learn More';

          var tags = card.querySelector('.program-card__tags');
          var content = card.querySelector('.content') || card;

          if (tags && tags.parentNode === content) {
            content.insertBefore(ctaWrap, tags);
          } else {
            content.appendChild(ctaWrap);
          }
        });
    }
  };

  // Renders session date ranges and format badges on program cards from the session paragraph field.
  Drupal.behaviors.programCardSessionEnhancements = {
    attach: function (context) {
      once('programCardSessionEnhancements', ':is(.view-programs-cfm, .view-id-programs_cfm) article.program-card', context)
        .forEach(function (card) {
          var sessionField = card.querySelector('.field--name-field-program-session');
          if (!sessionField) return;

          var sessionItems = Array.prototype.slice.call(
            sessionField.querySelectorAll('.field__items > .field__item')
          );
          if (!sessionItems.length) return;

          // Collect unique formats from sessions and rebuild the header badges.
          var header = card.querySelector('.program-card__header');
          if (header) {
            var seenFormats = {};
            var formatLinks = [];
            sessionItems.forEach(function (item) {
              var formatLink = item.querySelector('.field--name-field-program-format a[href]');
              if (!formatLink) return;
              var href = (formatLink.getAttribute('href') || '').trim();
              if (href && !seenFormats[href]) {
                seenFormats[href] = true;
                formatLinks.push(formatLink.cloneNode(true));
              }
            });

            if (formatLinks.length) {
              header.innerHTML = '';
              formatLinks.forEach(function (link) {
                var wrap = document.createElement('div');
                wrap.className = 'field field--name-field-program-format field--type-entity-reference field--label-hidden field__item';
                wrap.appendChild(link);
                header.appendChild(wrap);
              });
            }
          }

          // Build formatted date ranges from session start/end date fields.
          var dateRanges = [];
          sessionItems.forEach(function (item) {
            var startTimeEl = item.querySelector('.field--name-field-session-start-date time[datetime]');
            var endTimeEl = item.querySelector('.field--name-field-session-end-date time[datetime]');
            if (!startTimeEl || !endTimeEl) return;

            var ordered = orderDatePair(
              startTimeEl.getAttribute('datetime') || '',
              endTimeEl.getAttribute('datetime') || ''
            );
            var rangeText = formatDateRangeText(
              ordered.startValue, ordered.endValue,
              ordered.startDate, ordered.endDate
            );
            if (rangeText) dateRanges.push(rangeText);
          });

          // Insert session dates above the session field.
          if (dateRanges.length > 0) {
            var sessionDatesEl = document.createElement('div');
            sessionDatesEl.className = 'program-card__session-dates';

            if (dateRanges.length > 3) {
              var multipleEl = document.createElement('p');
              multipleEl.className = 'program-card__session-label';
              multipleEl.textContent = 'Multiple sessions available';
              sessionDatesEl.appendChild(multipleEl);
            } else {
              dateRanges.forEach(function (range) {
                var p = document.createElement('p');
                p.className = 'program-card__session-date';
                p.textContent = range;
                sessionDatesEl.appendChild(p);
              });
            }

            var body = card.querySelector('.program-card__body');
            if (body) {
              body.insertBefore(sessionDatesEl, sessionField);
            }
          }

          // Hide day-and-time when multiple sessions exist (each has different times).
          if (sessionItems.length > 1) {
            card.querySelectorAll('.field--name-field-day-and-time').forEach(function (f) {
              f.style.display = 'none';
            });
          }

          // Hide the raw session paragraph field — data has been extracted above.
          sessionField.style.display = 'none';
        });
    }
  };

  // Adapts compact Program Feed cards to the same CTA/date/meta pattern as other program cards.
  Drupal.behaviors.programCompactCardsEnhancements = {
    attach: function (context) {
      once('programCompactCardsEnhancements', 'article.program-card-compact', context)
        .forEach(function (card) {
          var title = card.querySelector('h2, h5');
          var titleLink = title && title.querySelector('a[href]');
          var content = card.querySelector('.content');
          if (!title || !titleLink || !content) return;

          var imageField = content.querySelector('.field--name-field-post-featured-image');
          if (imageField && imageField.parentNode === content) {
            card.insertBefore(imageField, card.firstChild);
          }

          if (title.tagName && title.tagName.toLowerCase() !== 'h5') {
            var replacementTitle = document.createElement('h5');
            replacementTitle.className = title.className;
            while (title.firstChild) {
              replacementTitle.appendChild(title.firstChild);
            }
            title.parentNode.replaceChild(replacementTitle, title);
            title = replacementTitle;
          }

          var firstContentChild = content.firstElementChild;
          if (firstContentChild !== title) {
            content.insertBefore(title, firstContentChild);
          }

          var meta = content.querySelector('.program-card-compact__meta');
          var summaryField = content.querySelector('.field--name-field-program-summary');
          var dateField = content.querySelector('.field--name-field-event-dates, .field--name-field-program-start-date');
          var scheduleField = content.querySelector('.field--name-field-schedule');

          if (dateField) {
            var pair = getDatePairFromFields(content, {
              combinedSelector: '.field--name-field-event-dates',
              startSelector: '.field--name-field-program-start-date',
              endSelector: '.field--name-field-program-end-date'
            });
            var startText = pair ? pair.values.startValue : getFieldDateValue(dateField);
            var parsedStart = parseDateValue(startText);
            if (parsedStart && !isNaN(parsedStart.getTime())) {
              dateField.textContent = 'Starts ' + parsedStart.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
            } else {
              var normalizedDate = normalizeDateText(pair ? pair.values.startValue : dateField.textContent)
                .split(/\s*[–-]\s*/)[0]
                .replace(/,\s*\d{4}\s*$/, '')
                .trim();
              if (normalizedDate) {
                dateField.textContent = 'Starts ' + normalizedDate;
              }
            }
            content.insertBefore(dateField, title.nextSibling);
          }

          if (scheduleField) {
            var scheduleText = (scheduleField.textContent || '')
              .replace(/\s+/g, ' ')
              .trim();
            scheduleText = scheduleText.replace(/\s*\([^)]*\)/g, '');
            var tzMatch = scheduleText.match(/^(.*?\b(?:PT|ET|PST|PDT|EST|EDT|MST|MDT|CST|CDT|MT|CT)\b)/i);
            if (tzMatch) {
              scheduleText = tzMatch[1];
            }
            scheduleText = scheduleText.replace(/\s+/g, ' ').replace(/[.,;]\s*$/, '').trim();
            if (scheduleText) {
              scheduleField.textContent = scheduleText;
            }
            content.insertBefore(scheduleField, (dateField || title).nextSibling);
          }

          var audienceField = meta && meta.querySelector('.field--name-field-audience-type');
          var audienceLink = audienceField && audienceField.querySelector('a');
          var audienceText = audienceLink ? (audienceLink.textContent || '').trim().toLowerCase() : '';

          if (audienceField) {
            if (audienceText === 'professional') {
              if (audienceLink) {
                audienceLink.textContent = 'Training';
              }
            } else if (audienceText === 'public') {
              audienceField.style.display = 'none';
            }
          }

          var href = titleLink.getAttribute('href') || '';
          if (!href) return;

          var oldCta = content.querySelector('.program-card-compact__cta');
          if (oldCta) {
            oldCta.remove();
          }

          var footer = content.querySelector('.program-card-compact__footer');
          if (!footer) {
            footer = document.createElement('div');
            footer.className = 'program-card-compact__footer';
          }

          if (summaryField && summaryField.nextSibling !== footer) {
            content.insertBefore(footer, summaryField.nextSibling);
          } else if (!summaryField) {
            content.appendChild(footer);
          }

          if (meta && meta.parentNode !== footer) {
            footer.appendChild(meta);
          }

          var arrowLink = footer.querySelector('.program-card-compact__arrow');
          if (!arrowLink) {
            arrowLink = document.createElement('a');
            arrowLink.className = 'program-card-compact__arrow';
            arrowLink.setAttribute('aria-label', 'View program');
            footer.appendChild(arrowLink);
          }

          arrowLink.setAttribute('href', href);

          var arrowImage = arrowLink.querySelector('img');
          if (!arrowImage) {
            arrowImage = document.createElement('img');
            arrowImage.setAttribute('alt', '');
            arrowImage.setAttribute('aria-hidden', 'true');
            arrowLink.appendChild(arrowImage);
          }

          arrowImage.setAttribute('src', '/sites/default/files/2026-03/arrow-right-circle-fill-blue.svg');

          // Hide session paragraph data; inject start date + schedule if no node-level date was found.
          var sessionWrapper = content.querySelector('.field--name-field-program-session');
          if (!dateField && sessionWrapper) {
            var sessionParas = sessionWrapper.querySelectorAll('.paragraph--type--program-session');
            var nearest = null;
            var nearestPara = null;
            Array.prototype.forEach.call(sessionParas, function (para) {
              var timeEl = para.querySelector('.field--name-field-session-start-date time[datetime]');
              if (!timeEl) return;
              var d = new Date(timeEl.getAttribute('datetime'));
              if (isNaN(d.getTime())) return;
              if (!nearest || d < nearest) { nearest = d; nearestPara = para; }
            });
            if (nearest) {
              var sessionDateEl = document.createElement('div');
              sessionDateEl.className = 'field field--name-field-program-start-date';
              sessionDateEl.textContent = 'Starts ' + nearest.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
              content.insertBefore(sessionDateEl, title.nextSibling);

              if (nearestPara) {
                var dayTimeField = nearestPara.querySelector('.field--name-field-day-and-time');
                var sessionScheduleEl = null;
                if (dayTimeField) {
                  var dayTimeText = (dayTimeField.textContent || '').replace(/\s+/g, ' ').trim();
                  dayTimeText = dayTimeText.replace(/\s*\([^)]*\)/g, '');
                  var tzMatch2 = dayTimeText.match(/^(.*?\b(?:PT|ET|PST|PDT|EST|EDT|MST|MDT|CST|CDT|MT|CT)\b)/i);
                  if (tzMatch2) dayTimeText = tzMatch2[1];
                  dayTimeText = dayTimeText.replace(/\s+/g, ' ').replace(/[.,;]\s*$/, '').trim();
                  if (dayTimeText) {
                    sessionScheduleEl = document.createElement('div');
                    sessionScheduleEl.className = 'field field--name-field-schedule';
                    sessionScheduleEl.textContent = dayTimeText;
                    content.insertBefore(sessionScheduleEl, sessionDateEl.nextSibling);
                  }
                }

              }
            }
          }
          var sessionCount = sessionWrapper
            ? sessionWrapper.querySelectorAll('.paragraph--type--program-session').length
            : 0;
          if (sessionCount > 1) {
            var sessionCountEl = document.createElement('p');
            sessionCountEl.className = 'program-card-compact__session-count';
            sessionCountEl.textContent = 'Multiple sessions available';
            var scheduleInContent = content.querySelector('.field--name-field-schedule');
            var anchorEl = scheduleInContent || content.querySelector('.field--name-field-program-start-date, .field--name-field-event-dates');
            if (anchorEl) {
              content.insertBefore(sessionCountEl, anchorEl.nextSibling);
            }
          }

          if (sessionWrapper) {
            sessionWrapper.style.display = 'none';
          }

          card.classList.add('is-clickable');
          card.addEventListener('click', function (event) {
            if (event.defaultPrevented) return;

            var selection = window.getSelection ? window.getSelection() : null;
            if (selection && String(selection).trim()) return;

            var interactive = event.target.closest('a, button, input, select, textarea, summary, [role="button"]');
            if (interactive) return;

            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              window.open(titleLink.href, '_blank');
            } else {
              titleLink.click();
            }
          });
        });
    }
  };

  Drupal.behaviors.programFeedViewEmbedEnhancements = {
    attach: function (context) {
      once(
        'programFeedViewEmbedEnhancements',
        '.paragraph--type--program-feed',
        context
      ).forEach(function (embed) {
        if (!embed.querySelector('article.program-card-compact')) {
          return;
        }

        var sectionHeading = embed.querySelector(':scope > .field--name-field-section-heading');
        if (sectionHeading && (!sectionHeading.tagName || sectionHeading.tagName.toLowerCase() !== 'h2')) {
          sectionHeading = promoteHeading(sectionHeading, 'h2');
        }
        if (sectionHeading) {
          sectionHeading.classList.add('heading--h2-alt');
        }

        var viewContent = embed.querySelector('.view-content');
        if (!viewContent) return;

        var rows = Array.prototype.slice.call(viewContent.querySelectorAll(':scope > .views-row'));
        var openCount = 0;

        rows.forEach(function (row) {
          var card = row.querySelector('article.program-card-compact');
          if (!card) return;

          var now = Date.now();
          var visible = true;

          // Try node-level registration dates first.
          var registrationPair = getDatePairFromFields(card, {
            combinedSelector: '.field--name-field-registration-dates',
            startSelector: '.field--name-field-registration-start-date',
            endSelector: '.field--name-field-registration-end-date'
          });

          if (registrationPair && registrationPair.values.startDate && registrationPair.values.endDate) {
            visible = now >= registrationPair.values.startDate.getTime() &&
              now <= registrationPair.values.endDate.getTime();
          } else {
            // Fall back to session-level registration dates, mirroring sidebar logic:
            // a session is open if it has a registration link and either no dates or
            // dates that currently bracket now.
            var sessionItems = Array.prototype.slice.call(
              card.querySelectorAll('.field--name-field-program-session .field__items > .field__item')
            );

            if (sessionItems.length) {
              var hasAnyRegLink = false;
              var hasAnyOpenSession = false;

              sessionItems.forEach(function (item) {
                var regLinkEl = item.querySelector('.field--name-field-registration-link a[href]');
                if (!regLinkEl) return;
                hasAnyRegLink = true;

                // Read registration end date directly — do NOT use orderDatePair here,
                // as its auto-swap can incorrectly treat an expired session as open when
                // the start/end fields are entered in reverse order.
                var regEndEl = item.querySelector('.field--name-field-registration-end-date time[datetime]');
                var regEndDate = regEndEl ? parseDateValue(regEndEl.getAttribute('datetime') || '') : null;

                if (regEndDate) {
                  if (now <= regEndDate.getTime()) {
                    hasAnyOpenSession = true;
                  }
                } else {
                  // No registration end date in DOM — fall back to session end date.
                  var sessionEndEl = item.querySelector('.field--name-field-session-end-date time[datetime]');
                  var sessionEndDate = sessionEndEl ? parseDateValue(sessionEndEl.getAttribute('datetime') || '') : null;
                  if (!sessionEndDate || now <= sessionEndDate.getTime()) {
                    hasAnyOpenSession = true;
                  }
                }
              });

              // Only gate visibility if at least one session had a registration link.
              // If none did, we can't determine state — default to visible.
              if (hasAnyRegLink) {
                visible = hasAnyOpenSession;
              }
            }
          }

          row.style.display = visible ? '' : 'none';
          card.setAttribute('data-registration-open', visible ? 'true' : 'false');
          if (visible) {
            openCount += 1;
          }
        });

        viewContent.classList.remove(
          'program-feed-grid',
          'program-feed-grid--one',
          'program-feed-grid--two',
          'program-feed-grid--three'
        );
        viewContent.classList.add('program-feed-grid');

        if (openCount <= 1) {
          viewContent.classList.add('program-feed-grid--one');
        } else if (openCount === 2) {
          viewContent.classList.add('program-feed-grid--two');
        } else {
          viewContent.classList.add('program-feed-grid--three');
        }
      });
    }
  };

  function buildLocalEndOfDay(year, monthIndex, day) {
    return new Date(year, monthIndex, day, 23, 59, 59, 999);
  }

  function parseFundingOpportunityDateValue(rawValue) {
    var value = (rawValue || '').trim();
    var match;

    if (!value) return null;

    match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return buildLocalEndOfDay(
        parseInt(match[1], 10),
        parseInt(match[2], 10) - 1,
        parseInt(match[3], 10)
      );
    }

    match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return buildLocalEndOfDay(
        parseInt(match[3], 10),
        parseInt(match[1], 10) - 1,
        parseInt(match[2], 10)
      );
    }

    var parsedValue = new Date(value);
    if (!isNaN(parsedValue.getTime())) {
      return buildLocalEndOfDay(
        parsedValue.getFullYear(),
        parsedValue.getMonth(),
        parsedValue.getDate()
      );
    }

    return null;
  }

  function parseFundingOpportunityDueDates(card) {
    if (!card) return [];

    var field = card.querySelector('.field--name-field-application-due-date');
    if (!field) return [];

    var timeElements = field.querySelectorAll('time[datetime]');
    var dueDates = [];

    timeElements.forEach(function (timeEl) {
      var parsedDate = parseFundingOpportunityDateValue(timeEl.getAttribute('datetime') || '');
      if (parsedDate) {
        dueDates.push({
          date: parsedDate,
          timeEl: timeEl
        });
      }
    });

    if (dueDates.length) {
      return dueDates.sort(function (a, b) {
        return a.date.getTime() - b.date.getTime();
      });
    }

    var text = (field.textContent || '')
      .replace(/\s+/g, ' ')
      .replace(/^application due dates?\s*/i, '')
      .trim();

    if (!text) return [];

    var parsedTextDate = parseFundingOpportunityDateValue(text);
    return parsedTextDate ? [{ date: parsedTextDate, timeEl: null }] : [];
  }

  function updateFundingOpportunityDueDateDisplay(card, activeDueDate) {
    if (!card || !activeDueDate || !activeDueDate.timeEl) return;

    var field = card.querySelector('.field--name-field-application-due-date');
    if (!field) return;

    var items = field.querySelectorAll('.field__item');
    if (!items.length) return;

    items.forEach(function (item) {
      item.style.display = item.contains(activeDueDate.timeEl) ? '' : 'none';
    });
  }

  function getCurrentFundingOpportunityDueDate(card, now) {
    var dueDates = parseFundingOpportunityDueDates(card);
    if (!dueDates.length) return null;

    var currentTime = now ? now.getTime() : Date.now();
    for (var i = 0; i < dueDates.length; i += 1) {
      if (dueDates[i].date.getTime() >= currentTime) {
        return dueDates[i];
      }
    }

    return null;
  }

  function getFundingOpportunityCardKey(card) {
    if (!card) return '';

    var titleLink = card.querySelector('h2 a[href]');
    if (titleLink) {
      var href = (titleLink.getAttribute('href') || '').trim();
      if (href) return href;
    }

    var externalLink = card.querySelector('.field--name-field-external-link a[href]');
    if (externalLink) {
      var externalHref = (externalLink.getAttribute('href') || '').trim();
      if (externalHref) return externalHref;
    }

    return (card.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Forces Funding Opportunity external links to render as a consistent CTA label.
  Drupal.behaviors.fundingOpportunityCardCtaLabel = {
    attach: function (context) {
      once(
        'fundingOpportunityCardCtaLabel',
        '.view-reach-funding-opportunities article.funding-opportunity-card, .view-id-reach_funding_opportunities article.funding-opportunity-card',
        context
      ).forEach(function (card) {
        var field = card.querySelector('.field--name-field-external-link');
        if (!field) return;

        var link = field.querySelector('a[href]');
        if (!link) return;

        var original = (link.textContent || '').trim();
        if (original && original.toLowerCase() !== 'learn more') {
          link.setAttribute('data-original-url', original);
        }

        var ctaWrap = card.querySelector('.funding-opportunity-card__cta');
        var content = card.querySelector('.content') || card;

        if (!ctaWrap) {
          ctaWrap = document.createElement('div');
          ctaWrap.className = 'funding-opportunity-card__cta';
          content.appendChild(ctaWrap);
        }

        if (field.parentNode !== ctaWrap) {
          ctaWrap.appendChild(field);
        }

        link.textContent = 'Learn More';
        card.classList.add('is-cta-ready');
        });
    }
  };

  // Hides Funding Opportunity cards after their due date passes.
  Drupal.behaviors.fundingOpportunityCardHideExpired = {
    attach: function (context) {
      once(
        'fundingOpportunityCardHideExpired',
        '.view-reach-funding-opportunities article.funding-opportunity-card, .view-id-reach_funding_opportunities article.funding-opportunity-card',
        context
      ).forEach(function (card) {
        var now = new Date();
        var dueDate = getCurrentFundingOpportunityDueDate(card, now);
        var row = card.closest('.views-row');
        var target = row || card;
        var isExpired = !dueDate;

        if (dueDate) {
          updateFundingOpportunityDueDateDisplay(card, dueDate);
        }

        target.style.display = isExpired ? 'none' : '';
        card.setAttribute('data-funding-expired', isExpired ? 'true' : 'false');
      });
    }
  };

  // Hides duplicate Funding Opportunity rows created by multi-value due date output.
  Drupal.behaviors.fundingOpportunityCardDeduplicate = {
    attach: function (context) {
      var seenCardKeys = Object.create(null);

      once(
        'fundingOpportunityCardDeduplicate',
        '.view-reach-funding-opportunities article.funding-opportunity-card, .view-id-reach_funding_opportunities article.funding-opportunity-card',
        context
      ).forEach(function (card) {
        var cardKey = getFundingOpportunityCardKey(card);
        if (!cardKey) return;

        if (seenCardKeys[cardKey]) {
          var row = card.closest('.views-row');
          var target = row || card;
          target.style.display = 'none';
          card.setAttribute('data-funding-duplicate', 'true');
          return;
        }

        seenCardKeys[cardKey] = true;
        card.setAttribute('data-funding-duplicate', 'false');
      });
    }
  };

  // Aligns Funding Opportunity card field order with other cards by moving top badges above the title.
  Drupal.behaviors.fundingOpportunityCardMetaBeforeTitle = {
    attach: function (context) {
      once(
        'fundingOpportunityCardMetaBeforeTitle',
        '.view-reach-funding-opportunities article.funding-opportunity-card, .view-id-reach_funding_opportunities article.funding-opportunity-card',
        context
      ).forEach(function (card) {
        var dueDate = card.querySelector('.field--name-field-application-due-date');
        var mechanism = card.querySelector('.field--name-field-mechanism');
        var title = card.querySelector('h2');
        if (!title) return;

        var topMeta = card.querySelector('.funding-opportunity-card__top-meta');
        if (!topMeta) {
          topMeta = document.createElement('div');
          topMeta.className = 'funding-opportunity-card__top-meta';
        }

        if (topMeta.parentNode !== title.parentNode || topMeta.nextElementSibling !== title) {
          title.parentNode.insertBefore(topMeta, title);
        }

        [dueDate, mechanism].forEach(function (field) {
          if (!field || field.parentNode === topMeta) {
            return;
          }

          topMeta.appendChild(field);
        });
      });
    }
  };

  // Makes the Funding Opportunity card body clickable while preserving native link behavior.
  Drupal.behaviors.fundingOpportunityCardClickable = {
    attach: function (context) {
      once(
        'fundingOpportunityCardClickable',
        '.view-reach-funding-opportunities article.funding-opportunity-card, .view-id-reach_funding_opportunities article.funding-opportunity-card',
        context
      ).forEach(function (card) {
        var ctaLink = card.querySelector('.field--name-field-external-link a[href]');
        if (!ctaLink) return;

        card.classList.add('is-clickable');

        card.addEventListener('click', function (event) {
          if (event.defaultPrevented) return;

          var selection = window.getSelection ? window.getSelection() : null;
          if (selection && String(selection).trim()) return;

          var interactive = event.target.closest('a, button, input, select, textarea, summary, [role="button"]');
          if (interactive) return;

          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            window.open(ctaLink.href, '_blank');
          } else {
            ctaLink.click();
          }
        });
      });
    }
  };

  // Aligns Programs card field order with Study cards by moving format above title.
  Drupal.behaviors.programCardsFormatBeforeTitle = {
    attach: function (context) {
      once('programCardsFormatBeforeTitle', '.view-programs-cfm article.program-card, .view-id-programs_cfm article.program-card', context)
        .forEach(function (card) {
          var formatField = card.querySelector('.program-card__header');
          var title = card.querySelector('h2');
          if (!formatField || !title) return;
          if (formatField.parentNode === card && formatField.nextElementSibling === title) return;
          card.insertBefore(formatField, title);
        });
    }
  };

  // Matches Programs exposed search control behavior with Study view search UI.
  Drupal.behaviors.programsFilterSearchPlaceholder = {
    attach: function (context) {
      once('programsFilterSearchPlaceholder', '.view-programs-cfm .view-filters .form-item-keys input.form-text, .view-id-programs_cfm .view-filters .form-item-keys input.form-text', context)
        .forEach(function (input) {
          if (!input.getAttribute('placeholder')) {
            input.setAttribute('placeholder', 'Search Programs');
          }
          if (!input.getAttribute('aria-label')) {
            input.setAttribute('aria-label', 'Search Programs');
          }
        });
    }
  };

  // Toggles program registration state based on registration date window.
  Drupal.behaviors.programRegistrationToggle = {
    attach: function (context) {
      once('programRegistrationToggle', '.page-node-type-program .group-program-sidebar', context)
        .forEach(function (sidebar) {
          var usesSessionState = sidebar.hasAttribute('data-current-session-count');
          var startDate = null;
          var endDate = null;
          var isOpen = false;

          if (usesSessionState) {
            isOpen = parseInt(sidebar.getAttribute('data-current-session-count') || '0', 10) > 0;
          } else {
            var root = sidebar.closest('.page-node-type-program') || document;
            var registrationPair = getDatePairFromFields(root, {
              combinedSelector: '.field--name-field-registration-dates',
              startSelector: '.field--name-field-registration-start-date',
              endSelector: '.field--name-field-registration-end-date'
            });
            if (!registrationPair || !registrationPair.values.startDate || !registrationPair.values.endDate) return;

            startDate = registrationPair.values.startDate;
            endDate = registrationPair.values.endDate;

            var now = new Date();
            var nowTime = now.getTime();
            isOpen = nowTime >= startDate.getTime() && nowTime <= endDate.getTime();
          }

          sidebar.classList.remove('is-registration-open', 'is-registration-closed');
          sidebar.classList.add(isOpen ? 'is-registration-open' : 'is-registration-closed');
          sidebar.setAttribute('data-registration-state', isOpen ? 'open' : 'closed');

          var closeNotice = sidebar.querySelector('.program-registration-closes');
          if (isOpen && endDate) {
            var closeText = endDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            });
            if (!closeNotice) {
              closeNotice = document.createElement('p');
              closeNotice.className = 'program-registration-closes';
            }
            closeNotice.textContent = 'Registration closes ' + closeText + '.';
            var registrationField = sidebar.querySelector('.field--name-field-registration-link');
            if (registrationField) {
              sidebar.insertBefore(closeNotice, registrationField);
            } else {
              sidebar.appendChild(closeNotice);
            }
          } else if (closeNotice) {
            closeNotice.parentNode.removeChild(closeNotice);
          }

          var message = sidebar.querySelector('.program-registration-message');
          if (!isOpen) {
            if (!message) {
              message = document.createElement('p');
              message.className = 'program-registration-message';
              message.innerHTML = '<strong>Registration is currently closed.</strong> New sessions will be posted as they become available.';
              var subscribeField = sidebar.querySelector('.field--name-field-subscribe-link');
              if (subscribeField) {
                sidebar.insertBefore(message, subscribeField);
              } else {
                sidebar.appendChild(message);
              }
            }

            // Ensure the subscribe link opens in a new tab and has a fallback URL.
            var subscribeAnchor = sidebar.querySelector('.field--name-field-subscribe-link a');
            if (subscribeAnchor) {
              subscribeAnchor.setAttribute('target', '_blank');
              subscribeAnchor.setAttribute('rel', 'noopener noreferrer');
            } else if (!sidebar.querySelector('.program-subscribe-fallback')) {
              var fallbackEl = document.createElement('div');
              fallbackEl.className = 'field field--name-field-subscribe-link program-subscribe-fallback';
              var fallbackAnchor = document.createElement('a');
              fallbackAnchor.href = 'https://visitor.r20.constantcontact.com/manage/optin?v=001wHcMLujjwHLLK0pqrlf2LXq4VrkJzKtz_wTd9vMJ9JdcBsklg4D32ejjkAWBVCX-cxbFPkbklT-bkmM2xDeCbz7Il96fHHmvhNzeqOmDqETofjAWhL0J5Savq_PX3gwtzNoOcasJyf7ZdlavmePiSA%3D%3D';
              fallbackAnchor.textContent = 'Subscribe for Updates';
              fallbackAnchor.setAttribute('target', '_blank');
              fallbackAnchor.setAttribute('rel', 'noopener noreferrer');
              fallbackEl.appendChild(fallbackAnchor);
              sidebar.appendChild(fallbackEl);
            }
          } else if (message) {
            message.parentNode.removeChild(message);
          }
        });
    }
  };

  // Fallback for feature split variants when Twig class mapping is unavailable.
  Drupal.behaviors.featureSplitVariantAdapter = {
    attach: function (context) {
      once('featureSplitVariantAdapter', '.paragraph--type--feature-split', context).forEach(function (split) {
        var layoutField = split.querySelector(
          '.field--name-field-layout-variant, .field--name-field-layout_variant, [data-field-name="field_layout_variant"], .field--name-field-split-layout, .field--name-field-split_layout, [data-field-name="field_split_layout"]'
        );
        var widthField = split.querySelector(
          '.field--name-field-width-variant, .field--name-field-width_variant, [data-field-name="field_width_variant"], .field--name-field-split-width, .field--name-field-split_width, [data-field-name="field_split_width"]'
        );
        var mobileOrderField = split.querySelector(
          '.field--name-field-mobile-order, .field--name-field-mobile_order, [data-field-name="field_mobile_order"], .field--name-field-split-mobile-order, .field--name-field-split-mobile_order, [data-field-name="field_split_mobile_order"]'
        );

        function getFieldText(fieldEl) {
          if (!fieldEl) return '';
          var item = fieldEl.querySelector('.field__item');
          var raw = item ? item.textContent : fieldEl.textContent;
          return (raw || '').replace(/\s+/g, ' ').trim().toLowerCase();
        }

        function hideField(fieldEl) {
          if (!fieldEl) return;
          fieldEl.style.display = 'none';
        }

        var layoutText = getFieldText(layoutField);
        var widthText = getFieldText(widthField);
        var mobileOrderText = getFieldText(mobileOrderField);

        if (/media[\s_-]*left/.test(layoutText)) {
          split.classList.add('layout-variant--media-left');
        }

        if (/text[\s_-]*emphasis/.test(widthText)) {
          split.classList.add('width-variant--text-emphasis');
        }

        if (/text[\s_-]*first/.test(mobileOrderText)) {
          split.classList.add('mobile-order--text-first');
        } else if (/media[\s_-]*first/.test(mobileOrderText)) {
          split.classList.add('mobile-order--media-first');
        }

        hideField(layoutField);
        hideField(widthField);
        hideField(mobileOrderField);
      });
    }
  };

  // Fallback for text section variants and accent colors when Twig class mapping is unavailable.
  Drupal.behaviors.textSectionVariantAdapter = {
    attach: function (context) {
      once('textSectionVariantAdapter', '.paragraph--type--text-section', context).forEach(function (section) {
        var styleField = section.querySelector(
          '.field--name-field-section-style, .field--name-field-section_style, [data-field-name="field_section_style"]'
        );
        var accentField = section.querySelector(
          '.field--name-field-accent-color, .field--name-field-accent_color, [data-field-name="field_accent_color"]'
        );

        function getFieldText(fieldEl) {
          if (!fieldEl) return '';
          var item = fieldEl.querySelector('.field__item');
          var raw = item ? item.textContent : fieldEl.textContent;
          return (raw || '').replace(/\s+/g, ' ').trim().toLowerCase();
        }

        function hideField(fieldEl) {
          if (!fieldEl) return;
          fieldEl.style.display = 'none';
        }

        var styleText = getFieldText(styleField);
        var accentText = getFieldText(accentField);
        var variantClass = 'text-section--default';
        var accentClass = '';

        if (/lead/.test(styleText)) {
          variantClass = 'text-section--lead';
        } else if (/callout/.test(styleText)) {
          variantClass = 'text-section--callout';
        }

        if (variantClass === 'text-section--callout') {
          if (/blue/.test(accentText)) {
            accentClass = 'bg-blue';
          } else if (/gold/.test(accentText)) {
            accentClass = 'bg-gold';
          } else if (/stone/.test(accentText)) {
            accentClass = 'bg-stone';
          } else if (/sand/.test(accentText)) {
            accentClass = 'bg-sand';
          } else {
            accentClass = 'bg-turquoise';
          }
        }

        section.classList.remove('text-section--default', 'text-section--lead', 'text-section--callout');
        section.classList.add(variantClass);
        section.classList.remove('bg-blue', 'bg-turquoise', 'bg-gold', 'bg-stone', 'bg-sand');

        if (accentClass) {
          section.classList.add(accentClass);
        }

        hideField(styleField);
        hideField(accentField);
      });
    }
  };

  // Promotes paragraph heading fields to semantic heading elements by paragraph type/variant.
  Drupal.behaviors.paragraphSemanticHeadingAdapter = {
    attach: function (context) {
      once(
        'paragraphSemanticHeadingAdapter',
        [
          '.paragraph--type--hero > .field--name-field-headline',
          '.paragraph--type--hero-full-width > .field--name-field-headline',
          '.paragraph--type--grid-card > .field--name-field-title',
          '.paragraph--type--card-grid > .field--name-field-section-heading',
          '.paragraph--type--feature-split > .field--name-field-section-heading',
          '.paragraph--type--feature-split > .section-content > .field--name-field-section-heading',
          '.paragraph--type--text-section > .field--name-field-section-heading',
          '.paragraph--type--cta-section > .field--name-field-section-heading',
          '.paragraph--type--view-embed > .field--name-field-section-heading'
        ].join(', '),
        context
      ).forEach(function (field) {
        var paragraph = field.closest('.paragraph');
        if (!paragraph) return;

        var tagName = 'h2';

        if (
          paragraph.classList.contains('paragraph--type--hero') ||
          paragraph.classList.contains('paragraph--type--hero-full-width')
        ) {
          tagName = 'h1';
        } else if (paragraph.classList.contains('paragraph--type--grid-card')) {
          tagName = 'h5';
        } else if (paragraph.classList.contains('paragraph--type--cta-section')) {
          tagName = 'h3';
        } else if (paragraph.classList.contains('paragraph--type--text-section')) {
          var styleField = paragraph.querySelector(
            '.field--name-field-section-style, .field--name-field-section_style, [data-field-name="field_section_style"]'
          );
          var styleText = '';
          if (styleField) {
            var styleItem = styleField.querySelector('.field__item');
            styleText = ((styleItem ? styleItem.textContent : styleField.textContent) || '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
          }

          if (paragraph.classList.contains('text-section--callout') || /callout/.test(styleText)) {
            tagName = 'h3';
          }
        }

        var headingField = field;
        if (!(field.tagName && field.tagName.toLowerCase() === tagName)) {
          headingField = promoteHeading(field, tagName);
        }

        if (!headingField) return;

        if (tagName === 'h2') {
          headingField.classList.add('heading--h2-alt');
        } else {
          headingField.classList.remove('heading--h2-alt');
        }
      });
    }
  };

  // Maps View Embed alignment control values to heading alignment modifier classes.
  Drupal.behaviors.viewEmbedAlignmentAdapter = {
    attach: function (context) {
      once('viewEmbedAlignmentAdapter', '.paragraph--type--view-embed', context).forEach(function (embed) {
        var alignmentField = embed.querySelector('.field--name-field-content-alignment');
        var alignmentText = alignmentField
          ? (alignmentField.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
          : '';

        embed.classList.remove('view-embed-align-left', 'view-embed-align-center');
        embed.classList.add(alignmentText === 'center' ? 'view-embed-align-center' : 'view-embed-align-left');

        if (alignmentField) {
          alignmentField.style.display = 'none';
        }
      });
    }
  };

  // Renders top divider only when boolean field value is enabled.
  Drupal.behaviors.topDividerFieldAdapter = {
    attach: function (context) {
      once('topDividerFieldAdapter', '.field--name-field-show-top-divider', context).forEach(function (field) {
        var item = field.querySelector('.field__item');
        var raw = item ? item.textContent : field.textContent;
        var value = (raw || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var isOn = /^(on|yes|true|1)$/.test(value);

        field.classList.remove('is-on', 'is-off');
        field.classList.add(isOn ? 'is-on' : 'is-off');

        if (item) {
          item.textContent = '';
          item.setAttribute('aria-hidden', 'true');
        } else {
          field.textContent = '';
        }
      });
    }
  };

  // Uses Hero paragraph CTA label as link text and marks page for title suppression.
  Drupal.behaviors.heroFullWidthEnhancements = {
    attach: function (context) {
      once('heroFullWidthEnhancements', '.paragraph--type--hero-full-width', context).forEach(function (hero) {
        var ctaLabelField = hero.querySelector('.field--name-field-cta-label');
        var ctaLabelItem = ctaLabelField ? ctaLabelField.querySelector('.field__item') : null;
        var ctaLabelText = ctaLabelItem ? (ctaLabelItem.textContent || '').trim() : '';

        var ctaLink = hero.querySelector('.field--name-field-cta-link a');
        if (ctaLink && ctaLabelText) {
          ctaLink.textContent = ctaLabelText;
          ctaLink.setAttribute('aria-label', ctaLabelText);
        }

        if (ctaLabelField) {
          ctaLabelField.style.display = 'none';
        }

        var page = hero.closest('.page');
        if (page) {
          page.classList.add('has-hero-full-width');
        }
      });
    }
  };

  // Maps Hero paragraph control field values to modifier classes and page state.
  Drupal.behaviors.heroEnhancements = {
    attach: function (context) {
      once('heroEnhancements', '.paragraph--type--hero', context).forEach(function (hero) {
        var layoutField = hero.querySelector('.field--name-field-layout-width');
        var alignmentField = hero.querySelector('.field--name-field-content-alignment');
        var ctaField = hero.querySelector('.field--name-field-cta-link');
        var imageField = hero.querySelector('.field--name-field-background-image');
        var layoutText = layoutField ? (layoutField.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() : '';
        var alignmentText = alignmentField ? (alignmentField.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() : '';
        var ctaLink = ctaField ? ctaField.querySelector('a[href]') : null;
        var ctaHref = ctaLink ? (ctaLink.getAttribute('href') || '').trim() : '';
        var hasCta = Boolean(ctaLink && ctaHref && ctaHref !== '#');
        var image = imageField ? imageField.querySelector('img') : null;
        var imageSrc = image ? (image.getAttribute('src') || '').trim() : '';
        var hasImage = Boolean(image && imageSrc);

        hero.classList.remove(
          'hero-layout-contained',
          'hero-layout-full-width',
          'hero-align-left',
          'hero-align-center',
          'hero-has-cta',
          'hero-no-cta',
          'hero-has-image',
          'hero-no-image'
        );

        hero.classList.add(layoutText === 'contained' ? 'hero-layout-contained' : 'hero-layout-full-width');
        hero.classList.add(alignmentText === 'center' ? 'hero-align-center' : 'hero-align-left');
        hero.classList.add(hasCta ? 'hero-has-cta' : 'hero-no-cta');
        hero.classList.add(hasImage ? 'hero-has-image' : 'hero-no-image');

        if (layoutField) {
          layoutField.style.display = 'none';
        }

        if (alignmentField) {
          alignmentField.style.display = 'none';
        }

        if (ctaField && !hasCta) {
          ctaField.style.display = 'none';
        }

        if (imageField && !hasImage) {
          imageField.style.display = 'none';
        }

        var page = hero.closest('.page');
        if (page) {
          page.classList.add('has-hero');
        }
      });
    }
  };

  // Forces main-nav external links to open in the current tab and strips noopener.
  Drupal.behaviors.extLinkOverride = {
    attach: function (context) {
      once('extLinkOverrideNav', '#block-dxpr-theme-main-menu', context).forEach(function (nav) {
        function processLink(link) {
          enforceNavLink(link);
        }

        nav.querySelectorAll('a[href]').forEach(processLink);

        var observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach(function (node) {
                if (!node || node.nodeType !== 1) return;
                if (node.matches && node.matches('a[href]')) {
                  processLink(node);
                }
                node.querySelectorAll && node.querySelectorAll('a[href]').forEach(processLink);
              });
            } else if (mutation.type === 'attributes') {
              var target = mutation.target;
              if (!target || target.nodeType !== 1 || !target.matches('a[href]')) return;
              processLink(target);
            }
          });
        });

        observer.observe(nav, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['target', 'href']
        });
      });
    }
  };

})(Drupal, once);
</script>
