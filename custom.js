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

  function resourceCtaLabel(destinationType, resourceType) {
    if (destinationType === 'file_download') return 'Download';
    if (destinationType === 'soundcloud') return 'Listen';
    if (destinationType === 'video_platform') return 'Watch';
    if (resourceType === 'audio') return 'Listen';
    if (resourceType === 'video') return 'Watch';
    return 'Open Resource';
  }

  function findPrimaryResourceLink(card, destinationType) {
    var fileLink = card.querySelector('.field--name-field-primary-file a[href]');
    if (destinationType === 'file_download' && fileLink) {
      return fileLink;
    }

    var urlLink = card.querySelector('.field--name-field-primary-url a[href]');
    if (urlLink) return urlLink;

    if (fileLink) return fileLink;
    return card.querySelector('h2 a[href]');
  }

  function syncResourceCardCta(card) {
    if (!card) return;

    var destinationType = getResourceDestinationType(card);
    var resourceType = getResourceType(card);
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

  Drupal.behaviors.resourceCardEnhancements = {
    attach: function (context) {
      once(
        'resourceCardEnhancements',
        '.view-resources article.resource, .view-id-resources article.resource, .view-guided-meditations article.resource, .view-id-guided_meditations article.resource',
        context
      ).forEach(function (card) {
        if (!card.classList.contains('resource-card')) {
          card.classList.add('resource-card');
        }
        syncResourceCardCta(card);
      });
    }
  };

  Drupal.behaviors.resourceFilterUI = {
    attach: function (context) {
      once(
        'resourceFilterUI',
        '.view-resources .view-filters, .view-id-resources .view-filters, .view-guided-meditations .view-filters, .view-id-guided_meditations .view-filters',
        context
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
  };

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

  // Normalizes profile link labels to "View Profile" to avoid long URL overflow.
  Drupal.behaviors.reachProfileLinkLabel = {
    attach: function (context) {
      once(
        'reachProfileLinkLabel',
        '.view-reach-profiles-leadership .profile-card .field--name-field-profile-link a, .view-reach-profiles-members .profile-card .field--name-field-profile-link a, .view-id-reach_profiles_leadership .profile-card .field--name-field-profile-link a, .view-id-reach_profiles_members .profile-card .field--name-field-profile-link a, .profile-cards .profile-card .field--name-field-profile-link a',
        context
      ).forEach(function (link) {
        var original = (link.textContent || '').trim();
        if (original && original.toLowerCase() !== 'view profile') {
          link.setAttribute('data-original-url', original);
          link.textContent = 'View Profile';
        }
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

  // Program instructor layout handled by dedicated view mode; no DOM surgery here.

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
            if (regOriginal && regOriginal.toLowerCase() !== 'register now') {
              registration.setAttribute('data-original-url', regOriginal);
            }
            registration.textContent = 'Register Now';
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
        '.page-node-type-program .field--name-field-event-dates, .view-programs-cfm .field--name-field-event-dates, .view-id-programs_cfm .field--name-field-event-dates',
        context
      )
        .forEach(function (field) {
          var items = field.querySelectorAll('.field__item');
          if (!items || items.length < 2) return;

          var startTime = items[0].querySelector('time[datetime]');
          var endTime = items[1].querySelector('time[datetime]');
          var startText = (items[0].textContent || '').trim();
          var endText = (items[1].textContent || '').trim();
          if ((!startTime || !endTime) && (!startText || !endText)) return;

          if (startTime && endTime) {
            var startValue = startTime.getAttribute('datetime') || '';
            var endValue = endTime.getAttribute('datetime') || '';
            if (startValue && endValue) {
              var startDate = new Date(startValue);
              var endDate = new Date(endValue);
              if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                var sameYear = startDate.getFullYear() === endDate.getFullYear();
                var startOptions = { month: 'long', day: 'numeric' };
                var endOptions = { month: 'long', day: 'numeric', year: 'numeric' };
                if (!sameYear) {
                  startOptions.year = 'numeric';
                }
                startText = startDate.toLocaleDateString('en-US', startOptions);
                endText = endDate.toLocaleDateString('en-US', endOptions);
              }
            }
          } else {
            // Fallback: use second item as end date and strip duplicate year from start.
            var normalizedStart = startText.replace(/\u00a0/g, ' ').trim();
            var normalizedEnd = endText.replace(/\u00a0/g, ' ').trim();

            var startParts = normalizedStart.split(/\s*[–-]\s*/);
            if (startParts.length >= 1) {
              normalizedStart = startParts[0].trim();
            }

            var startYearMatch = normalizedStart.match(/(\d{4})/);
            var endYearMatch = normalizedEnd.match(/(\d{4})/);
            if (startYearMatch && endYearMatch && startYearMatch[1] === endYearMatch[1]) {
              normalizedStart = normalizedStart.replace(/,\s*\d{4}\s*$/, '');
            }

            startText = normalizedStart;
            endText = normalizedEnd;
          }

          var target = items[0];
          target.textContent = startText + ' – ' + endText;

          for (var i = 1; i < items.length; i += 1) {
            items[i].style.display = 'none';
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

  function buildLocalEndOfDay(year, monthIndex, day) {
    return new Date(year, monthIndex, day, 23, 59, 59, 999);
  }

  function parseFundingOpportunityDueDate(card) {
    if (!card) return null;

    var field = card.querySelector('.field--name-field-application-due-date');
    if (!field) return null;

    var timeEl = field.querySelector('time[datetime]');
    var datetime = timeEl ? (timeEl.getAttribute('datetime') || '').trim() : '';
    var match;

    if (datetime) {
      match = datetime.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return buildLocalEndOfDay(
          parseInt(match[1], 10),
          parseInt(match[2], 10) - 1,
          parseInt(match[3], 10)
        );
      }

      var parsedDatetime = new Date(datetime);
      if (!isNaN(parsedDatetime.getTime())) return parsedDatetime;
    }

    var text = (field.textContent || '')
      .replace(/\s+/g, ' ')
      .replace(/^application due date\s*/i, '')
      .trim();

    if (!text) return null;

    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return buildLocalEndOfDay(
        parseInt(match[3], 10),
        parseInt(match[1], 10) - 1,
        parseInt(match[2], 10)
      );
    }

    var parsedText = new Date(text);
    if (!isNaN(parsedText.getTime())) {
      return buildLocalEndOfDay(
        parsedText.getFullYear(),
        parsedText.getMonth(),
        parsedText.getDate()
      );
    }

    return null;
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
        var dueDate = parseFundingOpportunityDueDate(card);
        if (!dueDate) return;

        var now = new Date();
        var row = card.closest('.views-row');
        var target = row || card;
        var isExpired = dueDate.getTime() < now.getTime();

        target.style.display = isExpired ? 'none' : '';
        card.setAttribute('data-funding-expired', isExpired ? 'true' : 'false');
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

          ctaLink.click();
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
          var root = sidebar.closest('.page-node-type-program') || document;
          var datesField = root.querySelector('.field--name-field-registration-dates');
          if (!datesField) return;

          var timeNodes = datesField.querySelectorAll('time[datetime]');
          if (timeNodes.length < 2) return;

          var startValue = timeNodes[0].getAttribute('datetime') || '';
          var endValue = timeNodes[1].getAttribute('datetime') || '';
          if (!startValue || !endValue) return;

          var startDate = new Date(startValue);
          var endDate = new Date(endValue);
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

          if (startDate.getTime() > endDate.getTime()) {
            var temp = startDate;
            startDate = endDate;
            endDate = temp;
          }

          var now = new Date();
          var nowTime = now.getTime();
          var isOpen = nowTime >= startDate.getTime() && nowTime <= endDate.getTime();

          sidebar.classList.remove('is-registration-open', 'is-registration-closed');
          sidebar.classList.add(isOpen ? 'is-registration-open' : 'is-registration-closed');
          sidebar.setAttribute('data-registration-state', isOpen ? 'open' : 'closed');

          var closeNotice = sidebar.querySelector('.program-registration-closes');
          if (isOpen) {
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

  // Promote View Embed section headings to semantic H2s and suppress duplicate view titles.
  Drupal.behaviors.viewEmbedHeadingAdapter = {
    attach: function (context) {
      once('viewEmbedHeadingAdapter', '.paragraph--type--view-embed', context).forEach(function (embed) {
        var headingField = embed.querySelector('.field--name-field-section-heading');
        if (headingField) {
          var rawHeading = (headingField.textContent || '').replace(/\s+/g, ' ').trim();

          if (rawHeading && !headingField.querySelector('h2')) {
            headingField.textContent = '';

            var heading = document.createElement('h2');
            heading.className = 'heading--h2-alt';
            heading.textContent = rawHeading;
            headingField.appendChild(heading);
          }
        }

        embed.querySelectorAll('.viewsreference--view-title').forEach(function (title) {
          title.style.display = 'none';
          title.setAttribute('aria-hidden', 'true');
        });
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
