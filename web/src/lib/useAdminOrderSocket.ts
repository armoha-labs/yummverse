import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./apiClient";
import { tokenStore } from "./tokenStore";

/** Live-prints a receipt the instant a new order arrives, instead of relying on the
 * customer's own device to print its own copy. The backend already broadcasts "order.created"
 * to this tenant's admin room the moment an order enters the kitchen queue (paid, or a
 * pay-later opt-in) — see realtimeEvents.ts's orderCreated — this just connects to it.
 *
 * Connects once per mount rather than on every render: `onOrderCreated` is read through a
 * ref so a new function identity each render (react-query's mutate isn't referentially
 * stable) never tears down and reopens the socket. */
export function useAdminOrderSocket(onOrderCreated: (orderId: string) => void): void {
  const callbackRef = useRef(onOrderCreated);
  useEffect(() => {
    callbackRef.current = onOrderCreated;
  }, [onOrderCreated]);

  useEffect(() => {
    const auth = tokenStore.get();
    if (!auth?.accessToken) return;

    const socket = io(API_BASE_URL || undefined, {
      auth: { type: "staff", token: auth.accessToken },
    });

    socket.on("order.created", (order: { _id?: string }) => {
      if (order?._id) callbackRef.current(order._id);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
