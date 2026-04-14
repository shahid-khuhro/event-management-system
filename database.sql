-- Create database
CREATE DATABASE IF NOT EXISTS event_db;
USE event_db;

-- Create Events table
CREATE TABLE IF NOT EXISTS Events (
    EventID INT AUTO_INCREMENT PRIMARY KEY,
    Title VARCHAR(50) NOT NULL,
    Date DATE NOT NULL,
    Location VARCHAR(50) NOT NULL,
    Organizer VARCHAR(50) NOT NULL
);

-- Create Attendees table
CREATE TABLE IF NOT EXISTS Attendees (
    AttendeeID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(30) NOT NULL,
    Email VARCHAR(30) NOT NULL,
    Phone VARCHAR(15) NOT NULL,
    EventID INT,
    FOREIGN KEY (EventID) REFERENCES Events(EventID) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO Events (Title, Date, Location, Organizer) VALUES
('Tech Conference 2025', '2025-05-15', 'Convention Center', 'Tech Org'),
('Music Festival', '2025-06-20', 'Central Park', 'Music Corp'),
('Business Workshop', '2025-07-10', 'Business Hub', 'Enterprise Ltd');

INSERT INTO Attendees (Name, Email, Phone, EventID) VALUES
('John Doe', 'john@email.com', '1234567890', 1),
('Jane Smith', 'jane@email.com', '0987654321', 1),
('Bob Wilson', 'bob@email.com', '1122334455', 2);