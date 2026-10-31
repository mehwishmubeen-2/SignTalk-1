// Context to manage an active call session across navigation
// This allows users to leave the full-screen video call and return to other pages
// while keeping the call running in the background

import React, { createContext, useContext, useState, ReactNode } from "react";

interface ActiveCallInfo {
  roomId: string;
  token: string;
  serverUrl: string;
  isMinimized: boolean;
}

interface ActiveCallContextType {
  activeCall: ActiveCallInfo | null;
  setActiveCall: (call: ActiveCallInfo | null) => void;
  minimizeCall: () => void;
  restoreCall: () => void;
  endCall: () => void;
}

const ActiveCallContext = createContext<ActiveCallContextType | undefined>(undefined);

export const ActiveCallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);

  const minimizeCall = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, isMinimized: true });
      console.log("📞 Call minimized");
    }
  };

  const restoreCall = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, isMinimized: false });
      console.log("📞 Call restored");
    }
  };

  const endCall = () => {
    console.log("📞 Call ended");
    setActiveCall(null);
  };

  return (
    <ActiveCallContext.Provider
      value={{
        activeCall,
        setActiveCall,
        minimizeCall,
        restoreCall,
        endCall,
      }}
    >
      {children}
    </ActiveCallContext.Provider>
  );
};

export const useActiveCall = () => {
  const context = useContext(ActiveCallContext);
  if (context === undefined) {
    throw new Error("useActiveCall must be used within ActiveCallProvider");
  }
  return context;
};
