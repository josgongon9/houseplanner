import React, { useState } from 'react';
import { User } from 'lucide-react';

export default function Avatar({ url, name, size = 'md' }) {
    const [failedUrl, setFailedUrl] = useState(null);
    const dimensions = size === 'xs' ? 'w-6 h-6' : 'w-10 h-10';
    if (!url || failedUrl === url) return <div className={`${dimensions} shrink-0 bg-slate-700 rounded-full flex items-center justify-center`}><User size={size === 'xs' ? 14 : 20} /></div>;
    return <img src={url} alt={name} onError={() => setFailedUrl(url)} className={`${dimensions} shrink-0 rounded-full border border-slate-600 object-cover`} />;
}
