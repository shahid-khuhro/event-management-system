const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: 'your_secret_key_here_change_this_to_something_secure',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Database connection
const db = mysql.createConnection({
    host: process.env.MYSQLHOST || 'localhost',
    port: process.env.MYSQLPORT || 3306,
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'event_db'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// ============ AUTHENTICATION MIDDLEWARE ============

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
}

// ============ USER AUTHENTICATION ROUTES ============

// User registration
app.post('/api/register', (req, res) => {
    const { username, email, password, phone } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    db.query('INSERT INTO Users (Username, Email, Password, Phone) VALUES (?, ?, ?, ?)',
        [username, email, password, phone], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Registration successful! Please login.' });
        });
});

// User login (both admin and regular users)
app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    
    // Check if it's admin login
    if (role === 'admin') {
        db.query('SELECT * FROM Admins WHERE Username = ?', [username], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid admin credentials' });
            }
            
            const admin = results[0];
            if (password === admin.Password) {
                req.session.user = {
                    id: admin.AdminID,
                    username: admin.Username,
                    email: admin.Email,
                    role: 'admin'
                };
                res.json({ message: 'Admin login successful', user: req.session.user });
            } else {
                res.status(401).json({ error: 'Invalid admin credentials' });
            }
        });
    } else {
        // Regular user login
        db.query('SELECT * FROM Users WHERE Username = ?', [username], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }
            
            const user = results[0];
            if (password === user.Password) {
                req.session.user = {
                    id: user.UserID,
                    username: user.Username,
                    email: user.Email,
                    phone: user.Phone,
                    role: 'user'
                };
                res.json({ message: 'Login successful', user: req.session.user });
            } else {
                res.status(401).json({ error: 'Invalid username or password' });
            }
        });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Check session
app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// ============ EVENT ROUTES ============

// Get all events (accessible to both admin and users)
// Get all events with registration count
app.get('/api/events', isAuthenticated, (req, res) => {
    const query = `
        SELECT 
            e.*,
            COUNT(r.RegistrationID) as attendeeCount
        FROM Events e
        LEFT JOIN User_Registrations r ON e.EventID = r.EventID
        GROUP BY e.EventID
        ORDER BY e.Date ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add event (admin only)
app.post('/api/events', isAdmin, (req, res) => {
    const { title, date, location, organizer } = req.body;
    
    if (!title || !date || !location || !organizer) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    db.query('INSERT INTO Events (Title, Date, Location, Organizer) VALUES (?, ?, ?, ?)',
        [title, date, location, organizer], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Event added successfully', eventId: result.insertId });
        });
});

// Delete event (admin only)
app.delete('/api/events/:id', isAdmin, (req, res) => {
    db.query('DELETE FROM Events WHERE EventID = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Event deleted successfully' });
    });
});

// ============ REGISTRATION ROUTES ============

// Register user for an event
app.post('/api/register-for-event', isAuthenticated, (req, res) => {
    const { eventId } = req.body;
    const userId = req.session.user.id;
    
    if (req.session.user.role === 'admin') {
        return res.status(403).json({ error: 'Admins cannot register for events' });
    }
    
    db.query('INSERT INTO User_Registrations (UserID, EventID) VALUES (?, ?)',
        [userId, eventId], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Already registered for this event' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Successfully registered for event!' });
        });
});

// Get user's registrations
app.get('/api/my-registrations', isAuthenticated, (req, res) => {
    if (req.session.user.role === 'admin') {
        // Admin can see all registrations
        const query = `
            SELECT r.*, e.Title as EventTitle, e.Date, u.Username 
            FROM User_Registrations r
            JOIN Events e ON r.EventID = e.EventID
            JOIN Users u ON r.UserID = u.UserID
            ORDER BY r.RegistrationDate DESC
        `;
        db.query(query, (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
    } else {
        // User sees only their registrations
        const userId = req.session.user.id;
        db.query(`
            SELECT r.*, e.Title as EventTitle, e.Date, e.Location 
            FROM User_Registrations r
            JOIN Events e ON r.EventID = e.EventID
            WHERE r.UserID = ?
            ORDER BY r.RegistrationDate DESC
        `, [userId], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
    }
});

// Cancel registration (user can cancel their own, admin can cancel any)
app.delete('/api/cancel-registration/:registrationId', isAuthenticated, (req, res) => {
    const registrationId = req.params.registrationId;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    let query;
    let params;
    
    if (userRole === 'admin') {
        query = 'DELETE FROM User_Registrations WHERE RegistrationID = ?';
        params = [registrationId];
    } else {
        query = 'DELETE FROM User_Registrations WHERE RegistrationID = ? AND UserID = ?';
        params = [registrationId, userId];
    }
    
    db.query(query, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registration not found' });
        }
        res.json({ message: 'Registration cancelled successfully' });
    });
});

// ============ USER MANAGEMENT (Admin only) ============

// Get all users (admin only)
app.get('/api/users', isAdmin, (req, res) => {
    db.query('SELECT UserID, Username, Email, Phone, CreatedAt FROM Users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Get all attendees (admin only - original attendees table)
app.get('/api/attendees', isAdmin, (req, res) => {
    db.query('SELECT * FROM Attendees', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Add attendee to original table (admin only)
app.post('/api/attendees', isAdmin, (req, res) => {
    const { name, email, phone, eventId } = req.body;
    db.query('INSERT INTO Attendees (Name, Email, Phone, EventID) VALUES (?, ?, ?, ?)',
        [name, email, phone, eventId], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Attendee added successfully' });
        });
});

// Delete attendee from original table (admin only)
app.delete('/api/attendees/:id', isAdmin, (req, res) => {
    db.query('DELETE FROM Attendees WHERE AttendeeID = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Attendee deleted successfully' });
    });
});

// Get statistics
app.get('/api/stats', isAuthenticated, (req, res) => {
    if (req.session.user.role === 'admin') {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM Events) as totalEvents,
                (SELECT COUNT(*) FROM Users) as totalUsers,
                (SELECT COUNT(*) FROM User_Registrations) as totalRegistrations
        `;
        db.query(query, (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results[0]);
        });
    } else {
        // User sees their stats
        const userId = req.session.user.id;
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM Events) as totalEvents,
                (SELECT COUNT(*) FROM User_Registrations WHERE UserID = ?) as myRegistrations
        `;
        db.query(query, [userId], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results[0]);
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});