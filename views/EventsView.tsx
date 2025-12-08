import React, { useState, useEffect } from 'react';
import { Bulletin, ChurchEvent } from '../types';
import { getBulletins, deleteBulletin, deleteEvent } from '../services/storageService';

interface EventsViewProps {
  onScanBulletin: () => void;
}

const EventsView: React.FC<EventsViewProps> = ({ onScanBulletin }) => {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const savedBulletins = await getBulletins();
    setBulletins(savedBulletins);
    
    // Aggregate and sort events
    const allEvents = savedBulletins.flatMap(b => b.events);
    // Sort by date (ascending), then time
    allEvents.sort((a, b) => {
        const dateA = new Date(`${a.date}T${convertTo24Hour(a.time)}`).getTime();
        const dateB = new Date(`${b.date}T${convertTo24Hour(b.time)}`).getTime();
        return dateA - dateB;
    });

    // Filter out past events (older than yesterday to allow for slight timezone diffs)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const upcomingEvents = allEvents.filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= yesterday;
    });

    setEvents(upcomingEvents);
  };

  const convertTo24Hour = (timeStr: string) => {
     // Basic helper to approximate time for sorting
     // e.g. "7:00 PM" -> "19:00:00"
     // If parsing fails, return a default
     try {
         const [time, modifier] = timeStr.split(' ');
         let [hours, minutes] = time.split(':');
         if (hours === '12') hours = '00';
         if (modifier && modifier.toUpperCase() === 'PM') hours = (parseInt(hours, 10) + 12).toString();
         return `${hours.padStart(2, '0')}:${minutes}:00`;
     } catch(e) {
         return "00:00:00";
     }
  }

  const addToCalendar = (event: ChurchEvent) => {
      // Create .ics content
      const startDate = event.date.replace(/-/g, ''); // YYYYMMDD
      const startTime = convertTo24Hour(event.time).replace(/:/g, '').substring(0,6);
      
      // Simple duration assumption (1 hour)
      
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
URL:${document.location.href}
DTSTART:${startDate}T${startTime}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:${event.location}
END:VEVENT
END:VCALENDAR`;

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${event.title}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDeleteBulletin = (id: string) => {
      if (window.confirm("Delete this bulletin?")) {
          deleteBulletin(id);
          loadData();
      }
  }

  const handleDeleteEvent = (e: React.MouseEvent, eventId?: string) => {
    e.stopPropagation(); // Stop event from bubbling up
    if (!eventId) return;
    
    if (window.confirm("Delete this event?")) {
        deleteEvent(eventId);
        loadData();
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto pb-24 max-w-md mx-auto relative">
      <h1 className="text-2xl font-serif font-bold text-white mb-6">Church Events</h1>

      {/* Upcoming Events Section */}
      <section className="mb-8">
          <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4">Upcoming Events</h2>
          {events.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
                  <p className="text-gray-400 text-sm">No upcoming events found.</p>
                  <p className="text-xs text-gray-500 mt-2">Scan a bulletin to add events.</p>
              </div>
          ) : (
              <div className="space-y-3">
                  {events.map((event, idx) => (
                      <div key={idx} className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg flex flex-col relative group">
                          
                          {/* Top Action Bar */}
                          <div className="flex justify-between items-start mb-2">
                              <div className="bg-gray-700 rounded px-2 py-1 text-center min-w-[50px]">
                                  <span className="block text-[10px] text-gray-400 uppercase font-bold">
                                      {new Date(event.date).toLocaleDateString(undefined, {month: 'short'})}
                                  </span>
                                  <span className="block text-xl font-bold text-white leading-none">
                                      {new Date(event.date).getDate()}
                                  </span>
                              </div>
                              
                              <div className="flex space-x-2">
                                {/* Delete Event Button */}
                                <button 
                                    onClick={(e) => handleDeleteEvent(e, event.id)}
                                    className="text-xs bg-gray-700 text-gray-400 px-2 py-1.5 rounded hover:bg-red-900/40 hover:text-red-300 transition-colors flex items-center z-10"
                                    title="Delete Event"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>

                                <button 
                                    onClick={() => addToCalendar(event)}
                                    className="text-xs bg-purple-900/40 text-purple-300 px-2 py-1.5 rounded hover:bg-purple-900/60 transition-colors flex items-center z-10"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Add to Cal
                                </button>
                              </div>
                          </div>
                          
                          <h3 className="text-lg font-bold text-white mb-1 pr-6">{event.title}</h3>
                          
                          <div className="flex items-center text-xs text-gray-400 mb-2 space-x-3">
                              <span className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {event.time}
                              </span>
                              <span className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {event.location}
                              </span>
                          </div>
                          
                          <p className="text-sm text-gray-300 leading-snug">{event.description}</p>
                      </div>
                  ))}
              </div>
          )}
      </section>

      {/* Archived Bulletins */}
      <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Digitized Bulletins</h2>
          {bulletins.length === 0 ? (
               <p className="text-xs text-gray-600 italic">No bulletins scanned yet.</p>
          ) : (
              <div className="space-y-3">
                  {bulletins.map(bulletin => (
                      <div key={bulletin.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                              <div>
                                  <h3 className="text-white font-medium text-sm">{bulletin.title}</h3>
                                  <p className="text-xs text-gray-500">Scanned on {new Date(bulletin.dateScanned).toLocaleDateString()}</p>
                              </div>
                              <button onClick={() => handleDeleteBulletin(bulletin.id)} className="text-gray-600 hover:text-red-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                              </button>
                          </div>
                          {bulletin.rawSummary && (
                              <div className="mt-2 bg-gray-800/50 p-2 rounded text-xs text-gray-400 border border-gray-800">
                                  <p className="font-bold mb-1 text-gray-500">Summary:</p>
                                  {bulletin.rawSummary}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          )}
      </section>

      {/* Scan Bulletin FAB */}
      <button 
        onClick={onScanBulletin}
        className="fixed bottom-20 right-6 bg-purple-600 text-white rounded-full p-4 shadow-xl border-2 border-purple-500 hover:bg-purple-700 active:scale-95 transition-all z-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

    </div>
  );
};

export default EventsView;