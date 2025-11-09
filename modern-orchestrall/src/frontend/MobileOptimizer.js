// src/frontend/MobileOptimizer.js - Mobile Optimization Manager
class MobileOptimizer {
  constructor() {
    this.isMobile = false;
    this.isTablet = false;
    this.isDesktop = false;
    this.touchDevice = false;
    this.deviceType = 'desktop';
    this.orientation = 'portrait';
    this.viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    this.init();
  }

  // Initialize mobile optimization
  init() {
    this.detectDevice();
    this.setupEventListeners();
    this.optimizeForDevice();
    this.setupTouchHandlers();
    this.setupResponsiveElements();
  }

  // Detect device type and capabilities
  detectDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Device type detection
    this.isMobile = width <= 768 || /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    this.isTablet = (width > 768 && width <= 1024) || /tablet|ipad|android(?!.*mobile)/i.test(userAgent);
    this.isDesktop = width > 1024 && !this.isMobile && !this.isTablet;
    
    // Touch capability detection
    this.touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Device type classification
    if (this.isMobile) {
      this.deviceType = 'mobile';
    } else if (this.isTablet) {
      this.deviceType = 'tablet';
    } else {
      this.deviceType = 'desktop';
    }
    
    // Orientation detection
    this.orientation = width > height ? 'landscape' : 'portrait';
    
    // Update viewport
    this.viewport = { width, height };
    
    console.log(`📱 Device detected: ${this.deviceType} (${this.orientation}) - ${width}x${height}`);
  }

  // Setup event listeners for responsive behavior
  setupEventListeners() {
    // Resize handler with debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 250);
    });
    
    // Orientation change handler
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100);
    });
    
    // Touch events for mobile optimization
    if (this.touchDevice) {
      this.setupTouchEvents();
    }
  }

  // Handle window resize
  handleResize() {
    const oldDeviceType = this.deviceType;
    const oldOrientation = this.orientation;
    
    this.detectDevice();
    
    if (oldDeviceType !== this.deviceType || oldOrientation !== this.orientation) {
      this.optimizeForDevice();
      this.emit('deviceChange', {
        deviceType: this.deviceType,
        orientation: this.orientation,
        viewport: this.viewport
      });
    }
  }

  // Handle orientation change
  handleOrientationChange() {
    const oldOrientation = this.orientation;
    this.detectDevice();
    
    if (oldOrientation !== this.orientation) {
      this.optimizeForOrientation();
      this.emit('orientationChange', {
        orientation: this.orientation,
        viewport: this.viewport
      });
    }
  }

  // Optimize interface for current device
  optimizeForDevice() {
    // Add device-specific CSS classes
    document.body.className = document.body.className.replace(/device-\w+/g, '');
    document.body.classList.add(`device-${this.deviceType}`);
    document.body.classList.add(`orientation-${this.orientation}`);
    
    if (this.touchDevice) {
      document.body.classList.add('touch-device');
    }
    
    // Optimize specific components
    this.optimizeTables();
    this.optimizeModals();
    this.optimizeNavigation();
    this.optimizeForms();
    this.optimizeButtons();
    this.optimizeImages();
  }

  // Optimize for orientation changes
  optimizeForOrientation() {
    // Adjust layout for orientation
    if (this.orientation === 'landscape' && this.isMobile) {
      this.optimizeForLandscape();
    } else if (this.orientation === 'portrait') {
      this.optimizeForPortrait();
    }
  }

  // Optimize tables for mobile
  optimizeTables() {
    const tables = document.querySelectorAll('.data-table');
    
    tables.forEach(table => {
      if (this.isMobile) {
        // Convert table to cards on mobile
        this.convertTableToCards(table);
      } else {
        // Restore table format on desktop
        this.restoreTableFromCards(table);
      }
    });
  }

  // Convert table to mobile-friendly cards
  convertTableToCards(table) {
    if (table.classList.contains('converted-to-cards')) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
    
    // Create cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'mobile-cards-container';
    cardsContainer.style.display = 'none';
    
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const card = document.createElement('div');
      card.className = 'mobile-card';
      
      cells.forEach((cell, index) => {
        if (headers[index]) {
          const field = document.createElement('div');
          field.className = 'mobile-card-field';
          
          const label = document.createElement('div');
          label.className = 'mobile-card-label';
          label.textContent = headers[index];
          
          const value = document.createElement('div');
          value.className = 'mobile-card-value';
          value.innerHTML = cell.innerHTML;
          
          field.appendChild(label);
          field.appendChild(value);
          card.appendChild(field);
        }
      });
      
      cardsContainer.appendChild(card);
    });
    
    // Insert cards container after table
    table.parentNode.insertBefore(cardsContainer, table.nextSibling);
    
    // Hide table and show cards
    table.style.display = 'none';
    cardsContainer.style.display = 'block';
    
    table.classList.add('converted-to-cards');
  }

  // Restore table from cards
  restoreTableFromCards(table) {
    if (!table.classList.contains('converted-to-cards')) return;
    
    const cardsContainer = table.parentNode.querySelector('.mobile-cards-container');
    if (cardsContainer) {
      cardsContainer.remove();
    }
    
    table.style.display = 'table';
    table.classList.remove('converted-to-cards');
  }

  // Optimize modals for mobile
  optimizeModals() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
      const modalContent = modal.querySelector('.modal-content');
      if (!modalContent) return;
      
      if (this.isMobile) {
        // Full screen modals on mobile
        modalContent.style.cssText = `
          width: 100vw;
          height: 100vh;
          margin: 0;
          border-radius: 0;
          max-width: none;
          max-height: none;
        `;
        
        // Add mobile-specific classes
        modal.classList.add('mobile-modal');
      } else {
        // Restore desktop modal styles
        modalContent.style.cssText = '';
        modal.classList.remove('mobile-modal');
      }
    });
  }

  // Optimize navigation for mobile
  optimizeNavigation() {
    const navs = document.querySelectorAll('nav, .navigation, .sidebar');
    
    navs.forEach(nav => {
      if (this.isMobile) {
        // Convert to mobile navigation
        this.convertToMobileNav(nav);
      } else {
        // Restore desktop navigation
        this.restoreDesktopNav(nav);
      }
    });
  }

  // Convert navigation to mobile format
  convertToMobileNav(nav) {
    if (nav.classList.contains('mobile-nav-converted')) return;
    
    // Add mobile navigation toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'mobile-nav-toggle';
    toggleButton.innerHTML = '<i class="fas fa-bars"></i>';
    toggleButton.addEventListener('click', () => {
      nav.classList.toggle('mobile-nav-open');
    });
    
    // Insert toggle button before nav
    nav.parentNode.insertBefore(toggleButton, nav);
    
    // Add mobile navigation styles
    nav.classList.add('mobile-nav', 'mobile-nav-converted');
    
    // Close nav when clicking outside
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !toggleButton.contains(e.target)) {
        nav.classList.remove('mobile-nav-open');
      }
    });
  }

  // Restore desktop navigation
  restoreDesktopNav(nav) {
    const toggleButton = nav.parentNode.querySelector('.mobile-nav-toggle');
    if (toggleButton) {
      toggleButton.remove();
    }
    
    nav.classList.remove('mobile-nav', 'mobile-nav-open', 'mobile-nav-converted');
  }

  // Optimize forms for mobile
  optimizeForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      if (this.isMobile) {
        // Add mobile form optimizations
        form.classList.add('mobile-form');
        
        // Optimize input fields
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          input.classList.add('mobile-input');
          
          // Prevent zoom on focus for iOS
          if (input.type === 'text' || input.type === 'email' || input.type === 'password') {
            input.style.fontSize = '16px';
          }
        });
      } else {
        // Remove mobile form optimizations
        form.classList.remove('mobile-form');
        
        const inputs = form.querySelectorAll('.mobile-input');
        inputs.forEach(input => {
          input.classList.remove('mobile-input');
          input.style.fontSize = '';
        });
      }
    });
  }

  // Optimize buttons for mobile
  optimizeButtons() {
    const buttons = document.querySelectorAll('button, .btn');
    
    buttons.forEach(button => {
      if (this.isMobile) {
        // Ensure minimum touch target size (44px)
        const computedStyle = window.getComputedStyle(button);
        const minSize = 44;
        
        if (parseInt(computedStyle.height) < minSize) {
          button.style.minHeight = `${minSize}px`;
          button.style.minWidth = `${minSize}px`;
        }
        
        button.classList.add('mobile-button');
      } else {
        button.classList.remove('mobile-button');
        button.style.minHeight = '';
        button.style.minWidth = '';
      }
    });
  }

  // Optimize images for mobile
  optimizeImages() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      if (this.isMobile) {
        // Make images responsive
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.classList.add('mobile-image');
        
        // Add lazy loading for performance
        if (!img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
        }
      } else {
        img.classList.remove('mobile-image');
        img.style.maxWidth = '';
        img.style.height = '';
      }
    });
  }

  // Setup touch event handlers
  setupTouchEvents() {
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
    
    // Add touch feedback
    document.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
        e.target.classList.add('touch-active');
      }
    });
    
    document.addEventListener('touchend', (e) => {
      if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
        setTimeout(() => {
          e.target.classList.remove('touch-active');
        }, 150);
      }
    });
  }

  // Setup touch handlers for specific elements
  setupTouchHandlers() {
    // Swipe gestures for navigation
    let startX = 0;
    let startY = 0;
    
    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', (e) => {
      if (!startX || !startY) return;
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const diffX = startX - endX;
      const diffY = startY - endY;
      
      // Horizontal swipe
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          // Swipe left
          this.handleSwipeLeft();
        } else {
          // Swipe right
          this.handleSwipeRight();
        }
      }
      
      // Vertical swipe
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
        if (diffY > 0) {
          // Swipe up
          this.handleSwipeUp();
        } else {
          // Swipe down
          this.handleSwipeDown();
        }
      }
      
      startX = 0;
      startY = 0;
    });
  }

  // Handle swipe gestures
  handleSwipeLeft() {
    // Close mobile navigation
    const mobileNav = document.querySelector('.mobile-nav-open');
    if (mobileNav) {
      mobileNav.classList.remove('mobile-nav-open');
    }
  }

  handleSwipeRight() {
    // Open mobile navigation
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav && this.isMobile) {
      mobileNav.classList.add('mobile-nav-open');
    }
  }

  handleSwipeUp() {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  handleSwipeDown() {
    // Refresh data (if applicable)
    if (window.refreshData) {
      window.refreshData();
    }
  }

  // Setup responsive elements
  setupResponsiveElements() {
    // Responsive text sizing
    this.setupResponsiveText();
    
    // Responsive spacing
    this.setupResponsiveSpacing();
    
    // Responsive grid layouts
    this.setupResponsiveGrids();
  }

  // Setup responsive text sizing
  setupResponsiveText() {
    const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div');
    
    textElements.forEach(element => {
      if (this.isMobile) {
        element.classList.add('mobile-text');
      } else {
        element.classList.remove('mobile-text');
      }
    });
  }

  // Setup responsive spacing
  setupResponsiveSpacing() {
    const containers = document.querySelectorAll('.container, .panel, .card');
    
    containers.forEach(container => {
      if (this.isMobile) {
        container.classList.add('mobile-spacing');
      } else {
        container.classList.remove('mobile-spacing');
      }
    });
  }

  // Setup responsive grid layouts
  setupResponsiveGrids() {
    const grids = document.querySelectorAll('.grid, .row, .columns');
    
    grids.forEach(grid => {
      if (this.isMobile) {
        grid.classList.add('mobile-grid');
      } else {
        grid.classList.remove('mobile-grid');
      }
    });
  }

  // Optimize for landscape orientation
  optimizeForLandscape() {
    // Adjust layout for landscape mobile
    document.body.classList.add('landscape-mobile');
    
    // Optimize tables for landscape
    const tables = document.querySelectorAll('.data-table');
    tables.forEach(table => {
      if (table.classList.contains('converted-to-cards')) {
        this.restoreTableFromCards(table);
      }
    });
  }

  // Optimize for portrait orientation
  optimizeForPortrait() {
    document.body.classList.remove('landscape-mobile');
    
    // Convert tables to cards if on mobile
    if (this.isMobile) {
      const tables = document.querySelectorAll('.data-table');
      tables.forEach(table => {
        this.convertTableToCards(table);
      });
    }
  }

  // Emit events
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    window.dispatchEvent(event);
  }

  // Get device information
  getDeviceInfo() {
    return {
      deviceType: this.deviceType,
      isMobile: this.isMobile,
      isTablet: this.isTablet,
      isDesktop: this.isDesktop,
      touchDevice: this.touchDevice,
      orientation: this.orientation,
      viewport: this.viewport
    };
  }

  // Check if device is mobile
  isMobileDevice() {
    return this.isMobile;
  }

  // Check if device is tablet
  isTabletDevice() {
    return this.isTablet;
  }

  // Check if device is desktop
  isDesktopDevice() {
    return this.isDesktop;
  }

  // Check if device supports touch
  isTouchDevice() {
    return this.touchDevice;
  }

  // Get current orientation
  getOrientation() {
    return this.orientation;
  }

  // Get viewport dimensions
  getViewport() {
    return this.viewport;
  }
}

// Global mobile optimizer instance
window.MobileOptimizer = window.MobileOptimizer || new MobileOptimizer();

module.exports = MobileOptimizer;
