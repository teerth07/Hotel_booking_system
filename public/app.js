// AuraStay App Client Logic
const API_URL = ''; // Relative path for endpoints

// Application State
let state = {
  token: localStorage.getItem('token') || null,
  user: null,
  currentView: 'rooms',
  searchParams: {
    checkIn: '',
    checkOut: '',
    type: 'All'
  },
  rooms: [],
  bookings: []
};

// DOM Elements
const authTriggerBtn = document.getElementById('auth-trigger-btn');
const authModal = document.getElementById('auth-modal');
const authCloseBtn = document.getElementById('auth-close-btn');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authForm = document.getElementById('auth-form');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');

const bookingModal = document.getElementById('booking-modal');
const bookingCloseBtn = document.getElementById('booking-close-btn');
const bookingForm = document.getElementById('booking-form');
const bookingRoomIdInput = document.getElementById('booking-room-id');
const bookingGuestNameInput = document.getElementById('booking-guest-name');
const bookingCancelBtn = document.getElementById('booking-cancel-btn');

const searchForm = document.getElementById('availability-search-form');
const searchCheckIn = document.getElementById('search-check-in');
const searchCheckOut = document.getElementById('search-check-out');
const searchRoomType = document.getElementById('search-room-type');
const roomsContainer = document.getElementById('rooms-container');
const roomResultsTitle = document.getElementById('room-results-title');
const roomResultsSubtitle = document.getElementById('room-results-subtitle');

const bookingsContainer = document.getElementById('bookings-container');
const navRoomsBtn = document.getElementById('nav-rooms-btn');
const navBookingsBtn = document.getElementById('nav-bookings-btn');
const userMenu = document.getElementById('user-menu');
const toastContainer = document.getElementById('toast-container');

// Auth Mode
let isRegisterMode = false;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  setupDates();
  bindEvents();
  
  if (state.token) {
    await fetchUserProfile();
  }
  
  updateHeaderUI();
  // Perform initial search using default dates
  performRoomSearch();
});

// Setup date limits and defaults
function setupDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatDate(today);
  const tomorrowStr = formatDate(tomorrow);

  searchCheckIn.value = todayStr;
  searchCheckIn.min = todayStr;

  searchCheckOut.value = tomorrowStr;
  searchCheckOut.min = tomorrowStr;

  state.searchParams.checkIn = todayStr;
  state.searchParams.checkOut = tomorrowStr;

  // Sync min date of checkOut dynamically when checkIn is modified
  searchCheckIn.addEventListener('change', (e) => {
    const selectedCheckIn = new Date(e.target.value);
    const minCheckOutDate = new Date(selectedCheckIn);
    minCheckOutDate.setDate(minCheckOutDate.getDate() + 1);
    
    const minCheckOutStr = formatDate(minCheckOutDate);
    searchCheckOut.min = minCheckOutStr;
    
    // Auto-update checkOut if it is now <= checkIn
    if (new Date(searchCheckOut.value) <= selectedCheckIn) {
      searchCheckOut.value = minCheckOutStr;
    }
    
    state.searchParams.checkIn = e.target.value;
    state.searchParams.checkOut = searchCheckOut.value;
  });

  searchCheckOut.addEventListener('change', (e) => {
    state.searchParams.checkOut = e.target.value;
  });
}

// Bind Element Event Listeners
function bindEvents() {
  // Navigation
  navRoomsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showView('rooms');
  });

  navBookingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!state.token) {
      showToast('Please sign in to view the booking list.', 'info');
      openAuthModal(false);
      return;
    }
    showView('bookings');
    fetchUserBookings();
  });

  // Auth Modals
  authTriggerBtn.addEventListener('click', () => openAuthModal(false));
  authCloseBtn.addEventListener('click', closeAuthModal);
  tabLogin.addEventListener('click', () => switchAuthMode(false));
  tabRegister.addEventListener('click', () => switchAuthMode(true));
  authForm.addEventListener('submit', handleAuthSubmit);

  // Booking Modal
  bookingCloseBtn.addEventListener('click', closeBookingModal);
  bookingCancelBtn.addEventListener('click', closeBookingModal);
  bookingForm.addEventListener('submit', handleBookingSubmit);

  // Search Submit
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.searchParams.checkIn = searchCheckIn.value;
    state.searchParams.checkOut = searchCheckOut.value;
    state.searchParams.type = searchRoomType.value;
    performRoomSearch();
  });
}

// View Routing Manager
function showView(viewName) {
  state.currentView = viewName;
  
  if (viewName === 'rooms') {
    document.getElementById('view-rooms').classList.remove('hidden');
    document.getElementById('view-bookings').classList.add('hidden');
    navRoomsBtn.classList.add('active');
    navBookingsBtn.classList.remove('active');
    document.getElementById('hero-section').classList.remove('hidden');
  } else {
    document.getElementById('view-rooms').classList.add('hidden');
    document.getElementById('view-bookings').classList.remove('hidden');
    navRoomsBtn.classList.remove('active');
    navBookingsBtn.classList.add('active');
    document.getElementById('hero-section').classList.add('hidden');
  }
}

// ==================== TOAST COMPONENT ====================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'danger') iconClass = 'fa-exclamation-circle';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==================== AUTH LOGIC ====================

function openAuthModal(registerMode = false) {
  authModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Lock scrolling
  switchAuthMode(registerMode);
}

function closeAuthModal() {
  authModal.classList.add('hidden');
  document.body.style.overflow = ''; // Unlock scrolling
  authForm.reset();
}

function switchAuthMode(registerMode) {
  isRegisterMode = registerMode;
  if (isRegisterMode) {
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    authTitle.textContent = 'Join AuraStay';
    authSubtitle.textContent = 'Create a luxury portal profile to reserve accommodations.';
    authSubmitBtn.querySelector('span').textContent = 'Create Account';
  } else {
    tabRegister.classList.remove('active');
    tabLogin.classList.add('active');
    authTitle.textContent = 'Welcome Back';
    authSubtitle.textContent = 'Sign in to access your reservation portfolio.';
    authSubmitBtn.querySelector('span').textContent = 'Sign In';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = authUsernameInput.value;
  const password = authPasswordInput.value;
  
  authSubmitBtn.disabled = true;
  authSubmitBtn.classList.add('loading');
  
  const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    
    if (isRegisterMode) {
      showToast('Registration successful! Please login.', 'success');
      switchAuthMode(false);
    } else {
      localStorage.setItem('token', data.token);
      state.token = data.token;
      state.user = data.user;
      showToast(`Welcome back, ${state.user.username}!`, 'success');
      closeAuthModal();
      updateHeaderUI();
      performRoomSearch(); // Refresh list to update booking trigger bindings
    }
  } catch (error) {
    showToast(error.message, 'danger');
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.classList.remove('loading');
  }
}

async function fetchUserProfile() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      state.user = data.user;
    } else {
      // Token is invalid/expired
      handleLogout();
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    handleLogout();
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  state.token = null;
  state.user = null;
  showToast('Logged out successfully.', 'info');
  updateHeaderUI();
  showView('rooms');
  performRoomSearch();
}

function updateHeaderUI() {
  if (state.token && state.user) {
    userMenu.innerHTML = `
      <div class="user-badge">
        <i class="fa-solid fa-user"></i>
        <span>${state.user.username} ${state.user.role === 'admin' ? '(Admin)' : ''}</span>
      </div>
      <button class="btn btn-outline" id="logout-btn"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    `;
    
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
  } else {
    userMenu.innerHTML = `
      <button class="btn btn-outline" id="auth-trigger-btn"><i class="fa-solid fa-right-to-bracket"></i> Sign In</button>
    `;
    document.getElementById('auth-trigger-btn').addEventListener('click', () => openAuthModal(false));
  }
}

// ==================== ROOM AVAILABILITY FLOW ====================

async function performRoomSearch() {
  const { checkIn, checkOut, type } = state.searchParams;
  
  roomsContainer.innerHTML = `
    <div class="loading-state">
      <i class="fa-solid fa-circle-notch fa-spin spinner"></i>
      <p>Searching live availabilities...</p>
    </div>
  `;

  roomResultsTitle.textContent = `Available Rooms (${formatDisplayDate(checkIn)} to ${formatDisplayDate(checkOut)})`;
  roomResultsSubtitle.textContent = `Displaying available room inventory for the chosen date range.`;

  try {
    const response = await fetch(`/api/rooms/availability?checkIn=${checkIn}&checkOut=${checkOut}&type=${type}`);
    if (!response.ok) throw new Error('Failed to retrieve room availability.');
    
    const rooms = await response.json();
    state.rooms = rooms;
    renderRooms(rooms);
  } catch (error) {
    showToast(error.message, 'danger');
    roomsContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not retrieve rooms. Please try again later.</p></div>`;
  }
}

// Format date into human-friendly string, e.g., "May 29, 2026"
function formatDisplayDate(dateStr) {
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

function renderRooms(rooms) {
  if (rooms.length === 0) {
    roomsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-circle-question"></i>
        <h3>No Rooms Available</h3>
        <p>There are no vacant rooms matching your search parameters for the selected dates. Try modifying your dates or room category filters.</p>
      </div>
    `;
    return;
  }

  roomsContainer.innerHTML = rooms.map(room => {
    const isAvailable = true; // By definition of API, these are available
    
    // Choose static SVG or nice visual block based on room type
    let roomTypeIcon = 'fa-bed';
    if (room.room_type.includes('Deluxe')) roomTypeIcon = 'fa-hotel';
    if (room.room_type.includes('Executive')) roomTypeIcon = 'fa-crown';
    if (room.room_type.includes('Penthouse')) roomTypeIcon = 'fa-star';

    // Mock Image URL mapping using Unsplash curated luxury hotel elements
    let imgUrl = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=400';
    if (room.image_url.includes('cozy')) imgUrl = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=400';
    if (room.image_url.includes('garden')) imgUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=400';
    if (room.image_url.includes('balcony')) imgUrl = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=400';
    if (room.image_url.includes('suite')) imgUrl = 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=400';
    if (room.image_url.includes('penthouse')) imgUrl = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=400';

    return `
      <div class="room-card">
        <div class="room-media">
          <img src="${imgUrl}" alt="${room.room_type}" class="room-img-fallback">
          <i class="fa-solid ${roomTypeIcon} card-icon"></i>
          <span class="room-badge badge-available">Available</span>
          <span class="room-number-tag">Room ${room.room_number}</span>
        </div>
        <div class="room-details">
          <h3 class="room-type">${room.room_type}</h3>
          <p class="room-desc">${room.description || 'Enjoy complete luxury in this room offering a comfortable mattress, private bathroom, and fully integrated room automation.'}</p>
          <div class="room-pricing-row">
            <div class="room-price-box">
              <span class="price-val">$${room.price_per_night}</span>
              <span class="price-lbl">per night</span>
            </div>
            <button class="btn btn-primary book-room-trigger" data-id="${room.id}">Book Now</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind triggers
  document.querySelectorAll('.book-room-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const roomId = e.target.closest('.book-room-trigger').dataset.id;
      initiateBooking(roomId);
    });
  });
}

// ==================== BOOKING FLOW ====================

function initiateBooking(roomId) {
  if (!state.token) {
    showToast('Please sign in to place a room booking.', 'info');
    openAuthModal(false);
    return;
  }

  const room = state.rooms.find(r => r.id == roomId);
  if (!room) {
    showToast('Room details missing.', 'danger');
    return;
  }

  bookingRoomIdInput.value = room.id;
  bookingGuestNameInput.value = state.user ? state.user.username : '';

  // Setup summary data
  const checkIn = new Date(state.searchParams.checkIn);
  const checkOut = new Date(state.searchParams.checkOut);
  
  const diffTime = Math.abs(checkOut - checkIn);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  document.getElementById('summary-check-in').textContent = formatDisplayDate(state.searchParams.checkIn);
  document.getElementById('summary-check-out').textContent = formatDisplayDate(state.searchParams.checkOut);
  document.getElementById('summary-duration').textContent = `${diffDays} Night${diffDays > 1 ? 's' : ''}`;
  document.getElementById('summary-rate').textContent = `$${room.price_per_night}`;
  
  const totalCost = diffDays * room.price_per_night;
  document.getElementById('summary-total').textContent = `$${totalCost}`;

  // Populate preview card
  let imgUrl = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=400';
  if (room.image_url.includes('cozy')) imgUrl = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=400';
  if (room.image_url.includes('garden')) imgUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=400';
  if (room.image_url.includes('balcony')) imgUrl = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=400';
  if (room.image_url.includes('suite')) imgUrl = 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=400';
  if (room.image_url.includes('penthouse')) imgUrl = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=400';

  document.getElementById('modal-room-preview').innerHTML = `
    <img src="${imgUrl}" alt="Room" class="room-preview-img">
    <div class="room-preview-info">
      <span class="room-preview-title">${room.room_type}</span>
      <span class="room-preview-number">Room ${room.room_number}</span>
    </div>
  `;

  // Open booking modal
  bookingModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
  bookingModal.classList.add('hidden');
  document.body.style.overflow = '';
  bookingForm.reset();
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  
  const room_id = parseInt(bookingRoomIdInput.value);
  const guest_name = bookingGuestNameInput.value;
  const check_in_date = state.searchParams.checkIn;
  const check_out_date = state.searchParams.checkOut;
  
  const confirmBtn = document.getElementById('booking-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Processing...';

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ room_id, guest_name, check_in_date, check_out_date })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to complete booking.');
    }

    showToast('Reservation confirmed successfully!', 'success');
    closeBookingModal();
    
    // Switch to booking history page
    showView('bookings');
    fetchUserBookings();
    
    // Re-trigger rooms inventory search to exclude the now-booked room
    performRoomSearch();
  } catch (error) {
    showToast(error.message, 'danger');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm & Book Room';
  }
}

// ==================== BOOKINGS PORTFOLIO ====================

async function fetchUserBookings() {
  const titleEl = document.getElementById('bookings-results-title');
  const subtitleEl = document.getElementById('bookings-results-subtitle');
  if (state.user && state.user.role === 'admin') {
    titleEl.innerHTML = `<i class="fa-solid fa-list-check text-primary"></i> Master Booking List`;
    subtitleEl.textContent = 'View and monitor all active and past guest bookings in the system.';
  } else {
    titleEl.innerHTML = `<i class="fa-solid fa-clock-rotate-left text-primary"></i> Your Bookings Portfolio`;
    subtitleEl.textContent = 'Manage and review your active and past reservations.';
  }

  bookingsContainer.innerHTML = `
    <div class="loading-state">
      <i class="fa-solid fa-circle-notch fa-spin spinner"></i>
      <p>Loading your reservations...</p>
    </div>
  `;

  try {
    const response = await fetch('/api/bookings', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!response.ok) throw new Error('Could not retrieve bookings list.');

    const bookings = await response.json();
    state.bookings = bookings;
    renderBookings(bookings);
  } catch (error) {
    showToast(error.message, 'danger');
    bookingsContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not fetch your reservation list.</p></div>`;
  }
}

function renderBookings(bookings) {
  if (bookings.length === 0) {
    bookingsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <h3>No Reservations Found</h3>
        <p>You have not placed any room bookings yet. Explore our rooms and book your first stay!</p>
        <button class="btn btn-outline" onclick="showView('rooms')">Browse Accommodations</button>
      </div>
    `;
    return;
  }

  bookingsContainer.innerHTML = bookings.map(booking => {
    const isBooked = booking.status === 'booked';
    const checkInFormatted = formatDisplayDate(booking.check_in_date);
    const checkOutFormatted = formatDisplayDate(booking.check_out_date);
    const guestLabel = state.user.role === 'admin' ? ` | Guest: <b>${booking.guest_name}</b> (Account: ${booking.guest_username})` : ` | Guest: <b>${booking.guest_name}</b>`;

    let statusHtml = `<span class="booking-item-status status-booked">Confirmed</span>`;
    if (booking.status === 'cancelled') {
      statusHtml = `<span class="booking-item-status status-cancelled">Cancelled</span>`;
    }

    return `
      <div class="booking-item-card">
        <div class="booking-item-main">
          <div class="booking-icon-wrapper">
            <i class="fa-solid fa-key"></i>
          </div>
          <div class="booking-item-details">
            <h3 class="booking-item-room">${booking.room_type} (Room ${booking.room_number})</h3>
            <span class="booking-item-dates">
              <i class="fa-solid fa-calendar-days"></i>
              ${checkInFormatted} to ${checkOutFormatted} ${guestLabel}
            </span>
          </div>
        </div>
        <div class="booking-item-meta">
          <div class="booking-item-price">
            <div class="price-val">$${booking.total_price}</div>
            <div class="price-lbl">Grand Total</div>
          </div>
          <div>
            ${statusHtml}
          </div>
          ${isBooked ? `<button class="btn btn-outline btn-danger cancel-booking-btn" data-id="${booking.id}"><i class="fa-solid fa-ban"></i> Cancel</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Bind cancels
  document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.cancel-booking-btn');
      const bookingId = targetBtn.dataset.id;
      if (confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
        cancelBooking(bookingId);
      }
    });
  });
}

async function cancelBooking(bookingId) {
  try {
    const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to cancel the booking.');
    }

    showToast('Your reservation has been successfully cancelled.', 'success');
    fetchUserBookings();
    
    // Re-trigger rooms inventory search to release the room on search view
    performRoomSearch();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}
