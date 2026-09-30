import { useEffect, useState } from 'react';

export function useToast() {
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), toastMsg.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  return { toastMsg, setToastMsg };
}
