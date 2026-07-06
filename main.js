/**
 * MAIN APPLICATION
 * Handles all client-side functionality for the real estate website
 */

(function() {
  'use strict';

  // =============================================
  // DOM REFS
  // =============================================
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  /**
   * Format a number as USD currency
   */
  function formatPrice(amount) {
    return '$' + amount.toLocaleString('en-US');
  }

  /**
   * Format a date string
   */
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  /**
   * Debounce function for scroll/resize events
   */
  function debounce(fn, delay = 100) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // =============================================
  // 1. FILL AGENT INFO
  // =============================================

  function fillAgentInfo() {
    const elements = $$('[data-config]');
    elements.forEach(el => {
      const key = el.dataset.config;
      const value = CONFIG[key];
      if (value !== undefined) {
        if (el.tagName === 'IMG') {
          el.src = value;
          el.alt = CONFIG.agentName + ' - ' + key.replace(/([A-Z])/g, ' $1').trim();
        } else if (el.tagName === 'A' && (key === 'phone' || key === 'email' || key === 'whatsapp')) {
          if (key === 'phone') el.href = 'tel:+' + value.replace(/[^0-9]/g, '');
          else if (key === 'email') el.href = 'mailto:' + value;
          else if (key === 'whatsapp') el.href = 'https://wa.me/' + value.replace(/[^0-9]/g, '');
          el.textContent = value;
        } else if (el.tagName === 'A' && (key === 'instagram' || key === 'facebook' || key === 'linkedin')) {
          el.href = value;
        } else {
          el.textContent = value;
        }
      }
    });

    // Fill credentials
    const credContainer = $('#credentialsContainer');
    if (credContainer && CONFIG.agentCredentials) {
      credContainer.innerHTML = CONFIG.agentCredentials.map(cred => 
        `<span class="credential-pill">✓ ${cred}</span>`
      ).join('');
    }

    // Fill stats
    const statsGrid = $('#statsGrid');
    if (statsGrid && CONFIG.stats) {
      statsGrid.innerHTML = CONFIG.stats.map((stat, i) => `
        <div class="stat-card animate-hidden" data-animate="fade-up" data-stagger="${i + 1}">
          <div class="stat-number" data-count="${stat.number}">0${stat.suffix || ''}</div>
          <div class="stat-label">${stat.label}</div>
        </div>
      `).join('');
    }
  }

  // =============================================
  // 2. RENDER LISTINGS
  // =============================================

  let allListings = [];

  function renderListings(listings) {
    const grid = $('#listingsGrid');
    if (!grid) return;

    allListings = listings || CONFIG.listings;

    if (!allListings || allListings.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-light);padding:40px 0;">No listings found.</p>`;
      return;
    }

    grid.innerHTML = allListings.map((listing, index) => `
      <div class="listing-card animate-hidden" data-animate="fade-up" data-stagger="${index + 1}" style="--stagger-index:${index}">
        <div class="card-image-wrapper">
          <img src="${listing.image}" alt="${listing.title}" class="card-image" loading="lazy" />
          <div class="card-badges">
            <span class="price-badge">${formatPrice(listing.price)}</span>
            <span class="status-badge">${listing.status}</span>
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-address">${listing.title}</h3>
          <div class="card-location">${listing.address}, ${listing.city}, ${listing.state}</div>
          <div class="card-details">
            <span>🛏️ ${listing.beds}</span>
            <span>🛁 ${listing.baths}</span>
            <span>📐 ${listing.sqft.toLocaleString()} sqft</span>
          </div>
          <p class="card-description">${listing.description}</p>
          <button class="btn-card" onclick="window.showSection('contact')">Contact Agent</button>
        </div>
      </div>
    `).join('');

    // Re-observe new elements
    observeAnimations();
  }

  // =============================================
  // 3. LISTING FILTER
  // =============================================

  function setupFilters() {
    const filterBtns = $$('.filter-btn');
    const grid = $('#listingsGrid');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        // Update active state
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const filter = this.dataset.filter;
        let filtered = [...CONFIG.listings];

        switch(filter) {
          case 'under300':
            filtered = filtered.filter(l => l.price < 300000);
            break;
          case '300to500':
            filtered = filtered.filter(l => l.price >= 300000 && l.price <= 500000);
            break;
          case 'over500':
            filtered = filtered.filter(l => l.price > 500000);
            break;
          default:
            filtered = [...CONFIG.listings];
        }

        // Animate out, then render filtered
        const cards = $$('.listing-card', grid);
        if (cards.length) {
          cards.forEach((card, i) => {
            setTimeout(() => {
              card.style.opacity = '0';
              card.style.transform = 'translateY(20px) scale(0.95)';
            }, i * 50);
          });
          setTimeout(() => {
            renderListings(filtered);
          }, cards.length * 50 + 200);
        } else {
          renderListings(filtered);
        }
      });
    });
  }

  // =============================================
  // 4. RENDER TESTIMONIALS
  // =============================================

  function renderTestimonials() {
    const grid = $('#testimonialsGrid');
    if (!grid || !CONFIG.testimonials) return;

    grid.innerHTML = CONFIG.testimonials.map((t, i) => {
      const stars = '★'.repeat(t.stars) + '☆'.repeat(5 - t.stars);
      return `
        <div class="testimonial-card animate-hidden" data-animate="fade-up" data-stagger="${i + 1}">
          <div class="quote-icon">"</div>
          <p class="testimonial-text">${t.text}</p>
          <div class="testimonial-stars">${stars}</div>
          <div class="testimonial-name">${t.name}</div>
          <div class="testimonial-location">${t.location}</div>
        </div>
      `;
    }).join('');

    observeAnimations();
  }

  // =============================================
  // 5. SPA NAVIGATION
  // =============================================

  let currentSection = 'home';

  function showSection(sectionId) {
    const sections = $$('.page-section');
    const navLinks = $$('.nav-link');
    const mobileLinks = $$('.mobile-nav-link');

    // Don't switch if already on this section
    if (currentSection === sectionId) return;

    // Find target section
    const target = $(`[data-section-name="${sectionId}"]`);
    if (!target) return;

    // Animate out current
    const current = $(`.page-section.active-section`);
    if (current && current !== target) {
      current.classList.add('transition-out');
      current.classList.remove('active-section');
    }

    // Animate in target
    setTimeout(() => {
      if (current) current.style.display = 'none';
      target.style.display = 'block';
      target.classList.remove('transition-out');
      target.classList.add('active-section');
      currentSection = sectionId;

      // Update nav links
      navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
      });
      mobileLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
      });

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Re-observe animations in new section
      setTimeout(observeAnimations, 200);

      // Close mobile menu if open
      closeMobileMenu();
    }, 300);

    // Update URL hash
    if (sectionId !== 'home') {
      history.pushState(null, '', '#' + sectionId);
    } else {
      history.pushState(null, '', window.location.pathname);
    }
  }

  function setupNavigation() {
    // Nav links
    $$('.nav-link, .mobile-nav-link').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const section = this.dataset.section;
        if (section) showSection(section);
      });
    });

    // CTA buttons
    $$('.nav-cta, .hero-buttons .btn, .about-content .btn, .btn-card').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const section = this.dataset.section;
        if (section) showSection(section);
      });
    });

    // Handle hash on load
    const hash = window.location.hash.replace('#', '');
    if (hash && $(`[data-section-name="${hash}"]`)) {
      setTimeout(() => showSection(hash), 100);
    }

    // Handle popstate
    window.addEventListener('popstate', () => {
      const h = window.location.hash.replace('#', '');
      if (h && $(`[data-section-name="${h}"]`)) {
        showSection(h);
      } else {
        showSection('home');
      }
    });
  }

  // Expose showSection globally for inline onclick handlers
  window.showSection = showSection;

  // =============================================
  // 6. MOBILE MENU
  // =============================================

  function setupMobileMenu() {
    const hamburger = $('#hamburgerBtn');
    const overlay = $('#mobileOverlay');
    const closeBtn = $('#mobileCloseBtn');

    function openMobileMenu() {
      overlay.classList.add('active');
      hamburger.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
      overlay.classList.remove('active');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    window.closeMobileMenu = closeMobileMenu;

    hamburger.addEventListener('click', () => {
      if (overlay.classList.contains('active')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    closeBtn.addEventListener('click', closeMobileMenu);

    // Close on link click
    $$('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === this) closeMobileMenu();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeMobileMenu();
      }
    });
  }

  // =============================================
  // 7. NAVIGATION SCROLL EFFECT
  // =============================================

  function setupNavScroll() {
    const navbar = $('#navbar');

    const handleScroll = debounce(() => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, 20);

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  // =============================================
  // 8. SCROLL ANIMATIONS (Intersection Observer)
  // =============================================

  let observer;

  function observeAnimations() {
    if (observer) {
      observer.disconnect();
    }

    const hiddenElements = $$('.animate-hidden');

    if (hiddenElements.length === 0) return;

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          // Check if it should be staggered
          const stagger = parseInt(el.dataset.stagger) || 1;
          const delay = (stagger - 1) * 100;
          setTimeout(() => {
            el.classList.add('animate-show');
          }, delay);
          observer.unobserve(el);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    });

    hiddenElements.forEach(el => observer.observe(el));
  }

  // =============================================
  // 9. STATS COUNT UP
  // =============================================

  let statsObserved = false;

  function setupStatsCount() {
    const statsSection = $('#section-stats');
    if (!statsSection) return;

    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !statsObserved) {
          statsObserved = true;
          animateStats();
        }
      });
    }, { threshold: 0.3 });

    statsObserver.observe(statsSection);
  }

  function animateStats() {
    const statNumbers = $$('.stat-number[data-count]');
    statNumbers.forEach(el => {
      const target = parseInt(el.dataset.count);
      const suffix = el.textContent.replace(/[0-9]/g, '');
      const duration = 2000;
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        el.textContent = current + suffix;
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = target + suffix;
        }
      }

      requestAnimationFrame(update);
    });
  }

  // =============================================
  // 10. FLOATING LABEL FORMS
  // =============================================

  function setupFloatingLabels() {
    const inputs = $$('.form-input');

    inputs.forEach(input => {
      // Check initial state
      if (input.value.trim() !== '') {
        input.classList.add('has-value');
      }

      input.addEventListener('focus', function() {
        this.classList.add('has-value');
        this.closest('.floating-group')?.querySelector('.form-error')?.classList.remove('visible');
      });

      input.addEventListener('blur', function() {
        if (this.value.trim() === '') {
          this.classList.remove('has-value');
        }
      });

      input.addEventListener('input', function() {
        if (this.value.trim() !== '') {
          this.classList.add('has-value');
        } else {
          this.classList.remove('has-value');
        }
      });
    });
  }

  // =============================================
  // 11. CONTACT FORM
  // =============================================

  function setupContactForm() {
    const form = $('#contactForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Validate
      const name = $('#contactName');
      const email = $('#contactEmail');
      const message = $('#contactMessage');
      let valid = true;

      [name, email, message].forEach(field => {
        field.classList.remove('error');
        if (!field.value.trim()) {
          field.classList.add('error');
          valid = false;
        }
      });

      if (email.value.trim() && !isValidEmail(email.value.trim())) {
        email.classList.add('error');
        valid = false;
      }

      if (!valid) return;

      // Submit
      const btn = $('#contactSubmitBtn');
      const btnText = btn.querySelector('.btn-text');
      const btnSpinner = btn.querySelector('.btn-spinner');
      const success = $('#contactSuccess');

      btn.disabled = true;
      btnText.textContent = 'Sending...';
      btnSpinner.classList.remove('hidden');

      try {
        const data = {
          clientId: CONFIG.clientId,
          visitor_name: name.value.trim(),
          visitor_email: email.value.trim(),
          visitor_phone: $('#contactPhone').value.trim(),
          interested_in: $('#contactInterest').value || 'general',
          message: message.value.trim()
        };

        const response = await fetch(CONFIG.workerUrl + '/leads/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Network error');

        success.classList.remove('hidden');
        this.reset();
        $$('.form-input', this).forEach(f => f.classList.remove('has-value'));

        // Reset after 5 seconds
        setTimeout(() => {
          success.classList.add('hidden');
        }, 5000);

      } catch (err) {
        console.error('Form submission error:', err);
        alert('There was an error sending your message. Please try again or call us directly.');
      } finally {
        btn.disabled = false;
        btnText.textContent = 'Send Message';
        btnSpinner.classList.add('hidden');
      }
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // =============================================
  // 12. VALUATION FORM
  // =============================================

  function setupValuationForm() {
    const form = $('#valuationForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Validate required fields
      const required = $$('[required]', this);
      let valid = true;

      required.forEach(field => {
        field.classList.remove('error');
        if (!field.value.trim()) {
          field.classList.add('error');
          valid = false;
        }
        if (field.type === 'email' && field.value.trim() && !isValidEmail(field.value.trim())) {
          field.classList.add('error');
          valid = false;
        }
      });

      if (!valid) return;

      const btn = $('#valuationSubmitBtn');
      const btnText = btn.querySelector('.btn-text');
      const btnSpinner = btn.querySelector('.btn-spinner');
      const success = $('#valuationSuccess');

      btn.disabled = true;
      btnText.textContent = 'Submitting...';
      btnSpinner.classList.remove('hidden');

      try {
        const data = {
          clientId: CONFIG.clientId,
          visitor_name: $('#valName').value.trim(),
          visitor_email: $('#valEmail').value.trim(),
          visitor_phone: $('#valPhone').value.trim(),
          property_address: $('#valAddress').value.trim(),
          property_city: $('#valCity').value.trim(),
          bedrooms: $('#valBedrooms').value,
          bathrooms: $('#valBathrooms').value,
          condition: $('#valCondition').value,
          sqft: $('#valSqft').value.trim(),
          property_type: $('#valPropertyType').value
        };

        const response = await fetch(CONFIG.workerUrl + '/leads/valuation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Network error');

        success.classList.remove('hidden');
        this.reset();
        $$('.form-input', this).forEach(f => f.classList.remove('has-value'));

        setTimeout(() => {
          success.classList.add('hidden');
        }, 6000);

      } catch (err) {
        console.error('Valuation submission error:', err);
        alert('There was an error submitting your valuation request. Please try again.');
      } finally {
        btn.disabled = false;
        btnText.textContent = 'Get Free Valuation';
        btnSpinner.classList.add('hidden');
      }
    });
  }

  // =============================================
  // 13. FOOTER YEAR
  // =============================================

  function setFooterYear() {
    const el = $('#footerYear');
    if (el) el.textContent = new Date().getFullYear();
  }

  // =============================================
  // 14. SMOOTH SCROLL FOR ANCHOR LINKS
  // =============================================

  function setupSmoothAnchors() {
    $$('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // =============================================
  // 15. KEYBOARD ACCESSIBILITY
  // =============================================

  function setupKeyboardAccessibility() {
    // Focus management for mobile menu
    const hamburger = $('#hamburgerBtn');
    const overlay = $('#mobileOverlay');

    hamburger.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });

    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const closeBtn = $('#mobileCloseBtn');
        if (closeBtn) closeBtn.click();
      }
    });
  }

  // =============================================
  // 16. PERFORMANCE OPTIMIZATIONS
  // =============================================

  function setupPerformance() {
    // Lazy load images
    if ('IntersectionObserver' in window) {
      const lazyImages = $$('img[loading="lazy"]');
      const imgObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.loading = 'lazy';
            imgObserver.unobserve(img);
          }
        });
      });
      lazyImages.forEach(img => imgObserver.observe(img));
    }
  }

  // =============================================
  // 17. INITIALIZATION
  // =============================================

  function init() {
    // Wait for DOM and CONFIG
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }

  function initApp() {
    // Check if CONFIG is loaded
    if (typeof CONFIG === 'undefined') {
      console.error('CONFIG not loaded. Check config.js file.');
      return;
    }

    // Fill dynamic content
    fillAgentInfo();
    renderListings();
    renderTestimonials();

    // Setup features
    setupFilters();
    setupNavigation();
    setupMobileMenu();
    setupNavScroll();
    setupStatsCount();
    setupFloatingLabels();
    setupContactForm();
    setupValuationForm();
    setFooterYear();
    setupSmoothAnchors();
    setupKeyboardAccessibility();
    setupPerformance();

    // Initial animation observation
    setTimeout(observeAnimations, 300);

    // Handle window resize for animation refresh
    const handleResize = debounce(() => {
      observeAnimations();
    }, 300);
    window.addEventListener('resize', handleResize);

    console.log('🏠 Sarah Coleman Realty initialized successfully.');
  }

  // Start the application
  if (typeof window !== 'undefined') {
    init();
  }

})();
