import { useState, useCallback } from "react";
const useGeolocation = () => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setIsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setIsLoading(false);
      },
      (err) => {
        setIsLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("User denied the request for Geolocation.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information is unavailable.");
            break;
          case err.TIMEOUT:
            setError("The request to get user location timed out.");
            break;
          default:
            setError("An unknown error occurred.");
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 1e4, maximumAge: 0 }
    );
  }, []);
  return { position, error, isLoading, getCurrentPosition };
};
export {
  useGeolocation
};
