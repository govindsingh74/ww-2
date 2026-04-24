import { useEffect, useState } from 'react';
import { Newspaper, Globe, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Notification } from '../lib/types';

export function NewsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifications(data ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
          <Newspaper size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-white text-2xl font-bold">World Dispatch</h2>
          <p className="text-gray-400 text-sm">Latest intelligence from the front lines</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Globe size={40} className="mx-auto mb-3 opacity-30" />
          <p>No dispatches yet. The world is quiet… for now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NewsCard key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsCard({ notification }: { notification: Notification }) {
  const typeConfig: Record<string, { icon: React.ReactNode; styles: string; label: string }> = {
    info: {
      icon: <Info size={15} />,
      styles: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
      label: 'Dispatch',
    },
    warning: {
      icon: <AlertTriangle size={15} />,
      styles: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
      label: 'Alert',
    },
    danger: {
      icon: <AlertTriangle size={15} />,
      styles: 'border-red-500/20 bg-red-500/5 text-red-400',
      label: 'Urgent',
    },
  };

  const config = typeConfig[notification.type] ?? typeConfig.info;
  const date = new Date(notification.created_at);
  const relative = formatRelative(date);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 hover:border-gray-700 transition-colors">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 ${config.styles}`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${config.styles.split(' ')[2]}`}>{config.label}</span>
          {notification.is_global && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Globe size={10} /> Global
            </span>
          )}
        </div>
        <p className="text-gray-200 text-sm leading-relaxed">{notification.message}</p>
        <p className="text-gray-600 text-xs mt-1.5">{relative}</p>
      </div>
    </div>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}
