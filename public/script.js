// Helper function to handle API responses with session check
async function fetchWithAuth(url, options = {}) {
    const response = await fetch(url, options);
    
    if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.href = '/login.html';
        throw new Error('Session expired');
    }
    
    return response;
}

// Update all fetch calls to use fetchWithAuth
// For example, change loadEvents to:
async function loadEvents() {
    try {
        const response = await fetchWithAuth('/api/events');
        const events = await response.json();
        displayEvents(events);
    } catch (error) {
        if (error.message !== 'Session expired') {
            console.error('Error loading events:', error);
        }
    }
}

// Similarly update all other fetch calls:
// - loadAttendees()
// - loadStats()
// - addEvent (in form submit)
// - deleteEvent
// - addAttendee
// - deleteAttendee

// API endpoints

const API = {
    events: '/api/events',
    attendees: '/api/attendees',
    stats: '/api/stats'
};

// Load all data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    loadAttendees();
    loadStats();
    
    // Setup form submissions
    document.getElementById('addEventForm').addEventListener('submit', addEvent);
    document.getElementById('addAttendeeForm').addEventListener('submit', addAttendee);
});

// Load events
async function loadEvents() {
    try {
        const response = await fetch(API.events);
        const events = await response.json();
        displayEvents(events);
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Failed to load events');
    }
}

// Display events in table
function displayEvents(events) {
    const tbody = document.getElementById('eventsTableBody');
    
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No events found</td></tr>';
        return;
    }
    
    tbody.innerHTML = events.map(event => `
        <tr>
            <td>${event.EventID}</td>
            <td>${escapeHtml(event.Title)}</td>
            <td>${formatDate(event.Date)}</td>
            <td>${escapeHtml(event.Location)}</td>
            <td>${escapeHtml(event.Organizer)}</td>
            <td><button class="delete-btn" onclick="viewEventAttendees(${event.EventID})">View Attendees</button></td>
        </tr>
    `).join('');
}

// Load attendees
async function loadAttendees() {
    try {
        const response = await fetch(API.attendees);
        const attendees = await response.json();
        displayAttendees(attendees);
    } catch (error) {
        console.error('Error loading attendees:', error);
        showError('Failed to load attendees');
    }
}

// Display attendees in table
function displayAttendees(attendees) {
    const tbody = document.getElementById('attendeesTableBody');
    
    if (attendees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No attendees found</td></tr>';
        return;
    }
    
    tbody.innerHTML = attendees.map(attendee => `
        <tr>
            <td>${attendee.AttendeeID}</td>
            <td>${escapeHtml(attendee.Name)}</td>
            <td>${escapeHtml(attendee.Email)}</td>
            <td>${attendee.Phone}</td>
            <td>${attendee.EventID}</td>
            <td><button class="delete-btn" onclick="deleteAttendee(${attendee.AttendeeID})">Delete</button></td>
        </tr>
    `).join('');
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(API.stats);
        const stats = await response.json();
        
        const totalEvents = stats.length;
        const totalAttendees = stats.reduce((sum, event) => sum + event.AttendeeCount, 0);
        
        document.getElementById('totalEvents').textContent = totalEvents;
        document.getElementById('totalAttendees').textContent = totalAttendees;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Add new event
async function addEvent(e) {
    e.preventDefault();
    
    const eventData = {
        title: document.getElementById('eventTitle').value,
        date: document.getElementById('eventDate').value,
        location: document.getElementById('eventLocation').value,
        organizer: document.getElementById('eventOrganizer').value
    };
    
    try {
        const response = await fetch(API.events, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });
        
        if (response.ok) {
            showSuccess('Event added successfully!');
            closeModal('addEventModal');
            document.getElementById('addEventForm').reset();
            refreshData();
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to add event');
        }
    } catch (error) {
        showError('Error adding event');
    }
}

// Delete event
async function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event? This will also delete all associated attendees.')) {
        try {
            const response = await fetch(`${API.events}/${eventId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showSuccess('Event deleted successfully!');
                refreshData();
            } else {
                showError('Failed to delete event');
            }
        } catch (error) {
            showError('Error deleting event');
        }
    }
}

// Add attendee
async function addAttendee(e) {
    e.preventDefault();
    
    const attendeeData = {
        name: document.getElementById('attendeeName').value,
        email: document.getElementById('attendeeEmail').value,
        phone: document.getElementById('attendeePhone').value,
        eventId: document.getElementById('attendeeEventId').value
    };
    
    try {
        const response = await fetch(API.attendees, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendeeData)
        });
        
        if (response.ok) {
            showSuccess('Attendee added successfully!');
            closeModal('addAttendeeModal');
            document.getElementById('addAttendeeForm').reset();
            refreshData();
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to add attendee');
        }
    } catch (error) {
        showError('Error adding attendee');
    }
}

// Delete attendee
async function deleteAttendee(attendeeId) {
    if (confirm('Are you sure you want to delete this attendee?')) {
        try {
            const response = await fetch(`${API.attendees}/${attendeeId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showSuccess('Attendee deleted successfully!');
                refreshData();
            } else {
                showError('Failed to delete attendee');
            }
        } catch (error) {
            showError('Error deleting attendee');
        }
    }
}

// Show delete event modal
function showDeleteEventModal() {
    const eventId = prompt('Enter Event ID to delete:');
    if (eventId && !isNaN(eventId)) {
        deleteEvent(parseInt(eventId));
    } else if (eventId) {
        showError('Please enter a valid Event ID');
    }
}

// Show delete attendee modal
function showDeleteAttendeeModal() {
    const attendeeId = prompt('Enter Attendee ID to delete:');
    if (attendeeId && !isNaN(attendeeId)) {
        deleteAttendee(parseInt(attendeeId));
    } else if (attendeeId) {
        showError('Please enter a valid Attendee ID');
    }
}

// View attendees for specific event
async function viewEventAttendees(eventId) {
    try {
        const response = await fetch(`${API.attendees}/event/${eventId}`);
        const attendees = await response.json();
        
        if (attendees.length === 0) {
            alert('No attendees registered for this event');
        } else {
            let message = `Attendees for Event #${eventId}:\n\n`;
            attendees.forEach(attendee => {
                message += `${attendee.Name} - ${attendee.Email} - ${attendee.Phone}\n`;
            });
            alert(message);
        }
    } catch (error) {
        showError('Error loading attendees');
    }
}

// Load events into dropdown for attendee form
async function loadEventsForDropdown() {
    try {
        const response = await fetch(API.events);
        const events = await response.json();
        const select = document.getElementById('attendeeEventId');
        
        select.innerHTML = '<option value="">Select Event</option>' +
            events.map(event => `<option value="${event.EventID}">${event.Title} (${formatDate(event.Date)})</option>`).join('');
    } catch (error) {
        console.error('Error loading events for dropdown:', error);
    }
}

// Show modals
function showAddEventModal() {
    document.getElementById('addEventModal').style.display = 'block';
}

function showAddAttendeeModal() {
    loadEventsForDropdown();
    document.getElementById('addAttendeeModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Refresh all data
function refreshData() {
    loadEvents();
    loadAttendees();
    loadStats();
}

// Utility functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}