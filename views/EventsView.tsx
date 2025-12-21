
import React, { useState, useEffect } from 'react';
import { Bulletin, ChurchEvent } from '../types';
import { getBulletins, deleteBulletin, deleteEvent } from '../services/storageService';

interface EventsViewProps {
  onScanBulletin: () => void;
}

const EventsView: React.FC<EventsViewProps> = ({ onScanBulletin }) => {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
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

        // Filter out past events (older than yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const upcomingEvents = allEvents.filter(e => {
            const eventDate = new Date(e.date);
            return eventDate >= yesterday;
        });

        setEvents(upcomingEvents);
    } catch (e) {
        console.error("Failed to load events:", e);
    } finally {
        setLoading(false);
    }
  };

  const convertTo24Hour = (timeStr: string) => {
     try {
         const cleanTime = timeStr.trim().toUpperCase();
         const isPM = cleanTime.includes('PM');
         const isAM = cleanTime.includes('AM');
         
         let [timePart] = cleanTime.split(/\s|[A-Z]/);
         let [hours, minutes] = timePart.split(':');
         
         let h = parseInt(hours, 10);
         if (isPM && h < 12) h += 12;
         if (isAM && h === 12) h = 0;
         
         return `${h.toString().padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}:00`;
     } catch(e) {
         return "00:00:00";
     }
  }

  const addToCalendar = (event: ChurchEvent) => {
      const startDate = event.date.replace(/-/g, '');
      const startTime = convertTo24Hour(event.time).replace(/:/g, '').substring(0,6);
      
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
      link.setAttribute('download', `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDeleteBulletin = async (id: string) => {
      if (window.confirm("Delete this bulletin?")) {
          await deleteBulletin(id);
          loadData();
      }
  }

  const handleDeleteEvent = async (e: React.MouseEvent, eventId?: string) => {
    e.stopPropagation();
    if (!eventId) return;
    
    if (window.confirm("Delete this event?")) {
        await deleteEvent(eventId);
        loadData();
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto pb-24 max-w-md mx-auto relative no-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-serif font-bold text-white">Church Events</h1>
        <button 
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-purple-400 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        </button>
      </div>

      <section className="mb-8">
          <h2 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-4">Upcoming Events</h2>
          {loading && events.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading church events...</div>
          ) : events.length === 0 ? (
              <div className="bg-gray-800/50 rounded-2xl p-8 text-center border border-gray-700/50 shadow-xl">
                  <div className="h-12 w-12 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm font-medium">No upcoming events</p>
                  <p className="text-xs text-gray-600 mt-2">Scan your church bulletin to automatically extract dates and times.</p>
              </div>
          ) : (
              <div className="space-y-4">
                  {events.map((event, idx) => (
                      <div key={idx} className="bg-gray-800 rounded-2xl p-5 border border-gray-700 shadow-lg relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
                          
                          <div className="flex justify-between items-start mb-4 relative z-10">
                              <div className="bg-purple-900/40 border border-purple-500/30 rounded-xl px-3 py-1.5 text-center min-w-[60px]">
                                  <span className="block text-[9px] text-purple-400 uppercase font-black tracking-tighter">
                                      {new Date(event.date).toLocaleDateString(undefined, {month: 'short'})}
                                  </span>
                                  <span className="block text-2xl font-black text-white leading-none">
                                      {new Date(event.date).getDate()}
                                  </span>
                              </div>
                              
                              <div className="flex space-x-2">
                                <button 
                                    onClick={(e) => handleDeleteEvent(e, event.id)}
                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={() => addToCalendar(event)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg shadow-md transition-all active:scale-95"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                              </div>
                          </div>
                          
                          <h3 className="text-xl font-bold text-white mb-2 pr-6 leading-tight">{event.title}</h3>
                          
                          <div className="flex flex-wrap items-center text-[11px] text-gray-400 mb-4 gap-4">
                              <span className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {event.time}
                              </span>
                              <span className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {event.location}
                              </span>
                          </div>
                          
                          <p className="text-sm text-gray-300 leading-relaxed bg-gray-900/40 p-3 rounded-xl border border-gray-700/50">{event.description}</p>
                      </div>
                  ))}
              </div>
          )}
      </section>

      <section>
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Archived Bulletins</h2>
          {bulletins.length === 0 ? (
               <p className="text-xs text-gray-600 italic">No bulletin history available.</p>
          ) : (
              <div className="grid grid-cols-1 gap-3">
                  {bulletins.map(bulletin => (
                      <div key={bulletin.id} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 flex justify-between items-center group">
                          <div className="min-w-0">
                              <h3 className="text-white font-bold text-sm truncate">{bulletin.title}</h3>
                              <p className="text-[10px] text-gray-500 mt-1">Digitized {new Date(bulletin.dateScanned).toLocaleDateString()}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteBulletin(bulletin.id)} 
                            className="p-2 text-gray-600 hover:text-red-400 transition-colors"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </section>

      <button 
        onClick={onScanBulletin}
        className="fixed bottom-20 right-6 bg-purple-600 text-white rounded-full p-4 shadow-2xl border-2 border-purple-500 hover:bg-purple-700 active:scale-95 transition-all z-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

    </div>
  );
};

export default EventsView;
