/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Circle, 
  Moon, 
  Sun, 
  Bell, 
  Briefcase, 
  ChevronRight,
  RotateCcw,
  Cloud,
  Timer,
  Wind,
  AlertTriangle
} from 'lucide-react';

interface Task {
  id: string;
  text: string;
  category: 'work' | 'gym';
  checked: boolean;
}

interface WeatherData {
  temp: number;
  condition: number; // weathercode
  max: number;
  min: number;
  advice: string;
}

const DEFAULT_TASKS: Task[] = [
  // 仕事用 (Work)
  { id: '1', text: 'ジャケット', category: 'work', checked: false },
  { id: '2', text: 'ワイシャツ', category: 'work', checked: false },
  { id: '3', text: 'ズボン', category: 'work', checked: false },
  { id: '4', text: 'ネクタイ', category: 'work', checked: false },
  { id: '5', text: 'ベルト', category: 'work', checked: false },
  { id: '6', text: '靴下', category: 'work', checked: false },
  { id: '7', text: '下着', category: 'work', checked: false },
  { id: '8', text: 'パンツ', category: 'work', checked: false },
  
  // その他 (Other/Gym)
  { id: '9', text: 'タオル', category: 'gym', checked: false },
  { id: '10', text: 'ボトル', category: 'gym', checked: false },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('suitup_tasks');
    const initialTasks = saved ? JSON.parse(saved) : DEFAULT_TASKS;
    
    // Check if it's Sunday to add Protein
    const isSunday = new Date().getDay() === 0;
    const hasProtein = initialTasks.some((t: Task) => t.id === 'protein');
    
    if (isSunday && !hasProtein) {
      return [...initialTasks, { id: 'protein', text: 'プロテイン', category: 'gym', checked: false }];
    } else if (!isSunday && hasProtein) {
      return initialTasks.filter((t: Task) => t.id !== 'protein');
    }
    
    return initialTasks;
  });

  const [reminderTime, setReminderTime] = useState(() => {
    return localStorage.getItem('suitup_reminder') || '23:00';
  });

  const [nextMeeting, setNextMeeting] = useState(() => {
    return localStorage.getItem('suitup_meeting') || '09:00';
  });

  const [gratitude, setGratitude] = useState(() => {
    return localStorage.getItem('suitup_gratitude') || '';
  });

  const [showSettings, setShowSettings] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0 });

  useEffect(() => {
    localStorage.setItem('suitup_reminder', reminderTime);
  }, [reminderTime]);

  useEffect(() => {
    localStorage.setItem('suitup_meeting', nextMeeting);
  }, [nextMeeting]);

  useEffect(() => {
    localStorage.setItem('suitup_gratitude', gratitude);
  }, [gratitude]);

  useEffect(() => {
    localStorage.setItem('suitup_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Weather Fetching (Tomorrow - Fukushima City)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.7608&longitude=140.4748&hourly=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo');
        const data = await res.json();
        
        // Find 07:00 AM for tomorrow for display
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(7, 0, 0, 0);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const targetIsoPrefix = `${tomorrowStr}T07:00`;
        
        const hourIndex = data.hourly.time.findIndex((t: string) => t.startsWith(targetIsoPrefix));
        const code = data.hourly.weathercode[hourIndex] || 0;
        
        // Full Day Rain Check (00:00 - 23:00)
        const allDayIndices = Array.from({ length: 24 }, (_, i) => 
          data.hourly.time.findIndex((t: string) => t.startsWith(`${tomorrowStr}T${String(i).padStart(2, '0')}:00`))
        );
        
        const rainHours = allDayIndices
          .map((idx, hour) => ({ idx, hour }))
          .filter(item => item.idx !== -1 && data.hourly.weathercode[item.idx] >= 51)
          .map(item => item.hour);

        // Commute Rain Check (Specific windows for bicycle commuters)
        const morningRain = rainHours.some(h => h >= 7 && h <= 9);
        const eveningRain = rainHours.some(h => h >= 17 && h <= 19);
        
        // Seasonal / Contextual Advice
        const month = new Date().getMonth() + 1;
        let adviceChunks = [];
        
        if (code >= 71) {
          adviceChunks.push("明日の朝は雪予報です。足元に注意してください。");
        } else if (code >= 51) {
          adviceChunks.push("明日の朝は雨予報です。傘の準備を。");
        } else if (code === 0 || code === 1) {
          adviceChunks.push("明日の朝は快晴です！最高のスタートを。");
        } else if (code === 2 || code === 3) {
          adviceChunks.push("明朝は曇り空になりそうです。");
        }

        // Daily Rain Summary (User request)
        if (rainHours.length > 0) {
          const startHour = Math.min(...rainHours);
          const endHour = Math.max(...rainHours);
          let rainSummary = `【雨予報】${startHour}時〜${endHour}時頃に雨が降る可能性があります。`;
          
          if (morningRain || eveningRain) {
            rainSummary += " 自転車通勤の方は特に注意が必要です。";
          }
          adviceChunks.push(rainSummary);
        }

        // Seasonal additions
        if (month >= 3 && month <= 5 && code < 51) {
          adviceChunks.push("花粉対策も忘れずに。");
        } else if (month >= 6 && month <= 8) {
          adviceChunks.push("水分を多めに用意しましょう。");
        } else if (month >= 11 || month <= 2) {
          adviceChunks.push("冷え込みに注意。一枚多めに。");
        }

        setWeather({
          temp: data.hourly.temperature_2m[hourIndex],
          condition: code,
          max: data.daily.temperature_2m_max[1],
          min: data.daily.temperature_2m_min[1],
          advice: adviceChunks.join(" ")
        });
      } catch (err) {
        console.error('Weather fetch failed', err);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 3600000); // 1 hour
    return () => clearInterval(interval);
  }, []);

  // Countdown Logic (Until 07:00 AM)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(7, 0, 0, 0);
      
      if (now.getHours() >= 7) {
        target.setDate(target.getDate() + 1);
      }
      
      const diff = target.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft({ hours, minutes });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // 1 min
    return () => clearInterval(interval);
  }, []);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t));
  };

  const resetRitual = () => {
    if (confirm('すべての準備をリセットしますか？')) {
      setTasks(prev => prev.map(t => ({ ...t, checked: false })));
      setGratitude('');
    }
  };

  const bgColor = useMemo(() => {
    if (!weather) return '#f2f2f2';
    const c = weather.condition;
    if (c === 0 || c === 1) return '#FF9500'; // Sunny
    if (c === 2 || c === 3) return '#FFFFFF'; // Cloudy
    if (c >= 51) return '#007AFF'; // Rain/Snow
    return '#f2f2f2';
  }, [weather]);

  const textColor = useMemo(() => {
    if (bgColor === '#FF9500' || bgColor === '#007AFF') return '#FFFFFF';
    return '#111111';
  }, [bgColor]);

  const totalDone = tasks.filter(t => t.checked).length;
  const isAllDone = tasks.every(t => t.checked);

  return (
    <div 
      className="min-h-screen transition-colors duration-1000 ease-in-out flex flex-col"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <main className="max-w-[1200px] mx-auto w-full px-6 md:px-12 py-8 md:py-20 flex-1 flex flex-col overflow-hidden sm:overflow-auto">
        {/* Header Section */}
        <header className="mb-6 md:mb-20 flex flex-row justify-between items-end gap-4 shrink-0">
          <div className="animate-slide">
            <div className={`label-micro mb-2 ${textColor === '#FFFFFF' ? 'text-white/60' : 'text-subtle'}`}>Daily Prep</div>
            <h1 className="text-4xl md:text-84px font-bold tracking-tighter leading-[0.95]">
              SUIT UP <br className="hidden md:block" /> {isAllDone ? 'READY' : 'TOMORROW'}
            </h1>
          </div>
          
          <div className="flex gap-6 md:gap-12 animate-slide [animation-delay:200ms]">
            {/* Weather Widget */}
            <a 
              href="https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=070000" 
              target="_blank" 
              rel="noreferrer"
              className="flex flex-col items-start hover:opacity-70 transition-opacity"
            >
              <div className={`label-micro mb-1 md:mb-2 flex items-center gap-2 ${textColor === '#FFFFFF' ? 'text-white/60' : 'text-subtle'}`}>
                <Wind size={10} /> Fukushima
              </div>
              {weather ? (
                <div className="flex items-center gap-2 md:gap-4 leading-none">
                  <div className="text-2xl md:text-4xl font-light tracking-tighter">
                    {weather.temp}°
                  </div>
                </div>
              ) : (
                <div className="h-6 w-12 bg-line animate-pulse rounded opacity-20" />
              )}
            </a>

            {/* Countdown Widget */}
            <div className="flex flex-col items-start md:items-end">
              <div className={`label-micro mb-1 md:mb-2 flex items-center gap-2 ${textColor === '#FFFFFF' ? 'text-white/60' : 'text-subtle'}`}>
                <Timer size={10} /> 07:00
              </div>
              <div className="text-2xl md:text-7xl font-light tracking-tighter leading-none">
                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}
              </div>
            </div>
          </div>
        </header>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16 flex-1 min-h-0">
          {/* Progress / Status (Sidebar on desktop, top bar on mobile) */}
          <aside className="lg:col-span-4 animate-slide [animation-delay:400ms] shrink-0">
            <div className="lg:sticky lg:top-12 space-y-4 md:space-y-12">
              <div className="flex items-center justify-between lg:block">
                <div className={`label-micro mb-1 lg:mb-8 ${textColor === '#FFFFFF' ? 'text-white/60' : 'text-subtle'}`}>Status</div>
                <div className="flex flex-col lg:items-start items-end">
                  <div className="text-3xl lg:text-7xl font-bold tracking-tighter leading-none">
                    {Math.round((totalDone / tasks.length) * 100)}%
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6">
                {/* Micro Smart Advice */}
                <div className={`p-3 md:p-4 rounded-xl text-[10px] md:text-xs flex items-start gap-3 transition-colors ${textColor === '#FFFFFF' ? 'bg-white/10' : 'bg-ink/5 shadow-sm border border-line'}`}>
                  {weather?.advice.includes('【雨予報】') || weather?.advice.includes('【自転車通勤注意】') 
                    ? <AlertTriangle size={14} className="shrink-0 text-accent font-bold mt-0.5" /> 
                    : <CheckCircle2 size={14} className="shrink-0 opacity-40 mt-0.5" />}
                  <p className="leading-tight">
                    {weather?.advice}
                  </p>
                </div>

                {/* Gratitude (Desktop Only or very small) */}
                <div className="hidden md:block space-y-3">
                  <div className={`label-micro ${textColor === '#FFFFFF' ? 'text-white/60' : 'text-subtle'}`}>Gratitude Note</div>
                  <textarea 
                    value={gratitude}
                    onChange={(e) => setGratitude(e.target.value)}
                    placeholder="今日良かったことを1つだけ..."
                    className={`w-full p-4 text-sm rounded-xl outline-none resize-none h-24 transition-all focus:ring-1 focus:ring-accent ${textColor === '#FFFFFF' ? 'bg-white/10 placeholder-white/40 text-white' : 'bg-ink/5 placeholder-slate-400 text-ink'}`}
                  />
                </div>

                <div className="flex items-center justify-between md:block">
                  {tasks.some(t => t.checked) && (
                    <button 
                      onClick={resetRitual}
                      className={`label-micro flex items-center gap-2 transition-colors ${textColor === '#FFFFFF' ? 'text-white/60' : 'text-subtle'}`}
                    >
                      <RotateCcw size={12} /> Reset Data
                    </button>
                  )}
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="md:hidden label-micro underline"
                  >
                    Settings
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Checklist */}
          <div className="lg:col-span-8 animate-slide [animation-delay:600ms] flex flex-col min-h-0">
            <div className={`label-micro mb-4 md:mb-8 ${textColor === '#FFFFFF' ? 'text-white/60' : 'text-subtle'}`}>Checklist</div>
            
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0 flex-1 min-h-0 overflow-y-auto pr-2 no-scrollbar">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`md:check-item group ${!task.checked ? 'check-card' : 'check-card checked'}`}
                >
                  <div className="hidden md:flex items-center gap-6 flex-1">
                    <div className={`check-checkbox ${task.checked ? 'checked' : ''} ${textColor === '#FFFFFF' ? 'border-white' : 'border-ink'}`} style={{ backgroundColor: task.checked ? (textColor === '#FFFFFF' ? '#fff' : '#111') : 'transparent' }}>
                      {task.checked && <CheckCircle2 size={14} className={textColor === '#FFFFFF' ? 'text-accent' : 'text-canvas'} />}
                    </div>
                    <div className="text-xl md:text-2xl font-medium tracking-tight">
                      {task.text}
                    </div>
                  </div>

                {/* Mobile Grid Tile */}
                <div className="md:hidden flex flex-col w-full h-full justify-between py-1">
                  <div className={`w-4 h-4 rounded-full border border-current flex items-center justify-center shrink-0 self-end ${task.checked ? 'bg-current font-bold' : ''}`}>
                    {task.checked && (
                      <CheckCircle2 size={10} className={textColor === '#FFFFFF' ? 'text-accent' : (bgColor === '#FFFFFF' || bgColor === '#f2f2f2' ? 'text-white' : 'text-canvas')} />
                    )}
                  </div>
                  <div className="text-base font-bold leading-tight line-clamp-2">{task.text}</div>
                </div>
                  
                  <ChevronRight size={18} className={`hidden md:block transition-colors ${textColor === '#FFFFFF' ? 'text-white/20' : 'text-line'}`} />
                </div>
              ))}
            </div>
            
            {/* Sync Status / Info */}
            <div className={`mt-4 md:mt-12 p-3 md:p-6 rounded-2xl flex items-center justify-between shrink-0 transition-colors ${textColor === '#FFFFFF' ? 'bg-white/10' : 'bg-ink/5 shadow-sm border border-line'}`}>
              <div className="flex items-center gap-4">
                <Briefcase size={16} className="opacity-50" />
                <div className="text-sm md:text-base font-bold">First Meeting: {nextMeeting}</div>
              </div>
              <div className="hidden md:block text-[10px] uppercase font-bold tracking-widest opacity-40">System Sync</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className={`mt-6 md:mt-32 pt-6 md:pt-12 border-t flex justify-between items-center shrink-0 ${textColor === '#FFFFFF' ? 'border-white/20 text-white/40' : 'border-line text-subtle opacity-50'}`}>
          <div className="label-micro text-[8px] md:text-[10px]">SuitUp v2.6 // Mobile Ready</div>
          <div className="label-micro hidden md:block">Preparation is Victory.</div>
        </footer>

        {/* Settings Side Panel */}
        <AnimatePresence>
          {showSettings && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
                className="fixed inset-0 bg-white/40 backdrop-blur-xl z-50"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white z-[60] p-8 md:p-12 flex flex-col shadow-2xl shadow-ink/10 text-ink"
              >
                <div className="flex justify-between items-center mb-12 md:mb-16">
                  <div className="label-micro">System Configuration</div>
                  <button onClick={() => setShowSettings(false)} className="label-micro hover:text-accent">Close</button>
                </div>

                <div className="flex-1 space-y-8 md:space-y-12 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <label className="label-micro block mb-4">Reminder</label>
                      <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="text-4xl w-full bg-transparent border-b border-line focus:border-accent outline-none font-extralight tracking-tighter text-ink" />
                    </div>
                    <div>
                      <label className="label-micro block mb-4">Meeting</label>
                      <input type="time" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} className="text-4xl w-full bg-transparent border-b border-line focus:border-accent outline-none font-extralight tracking-tighter text-ink" />
                    </div>
                  </div>
                  <div className="p-6 bg-ink/5 border border-line rounded-xl">
                    <div className="label-micro mb-2">Location</div>
                    <div className="text-xl font-medium tracking-tight">Fukushima City, JP</div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-line">
                  <button onClick={() => setShowSettings(false)} className="w-full py-4 md:py-6 bg-ink text-white label-micro hover:bg-accent transition-colors">Apply Changes</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}


