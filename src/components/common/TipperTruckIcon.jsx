import React from 'react';

/**
 * Heavy Tipper Lorry / Dump Truck Icon
 * Features:
 * - Heavy-duty tipper dumper body with protective cab canopy over cabin
 * - Reinforced side ribs
 * - Heavy commercial cabin with front grille & bumper
 * - Multi-axle heavy-load tandem wheels (10/12-wheeler tipper style)
 * - Hydraulic lifting mount area
 */
export const TipperTruckIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Heavy Tipper Dump Body with Cab Canopy Overhang */}
      {/* Path: starts at rear top, slopes to rear gate, bottom bed, front wall, cab canopy shield, back down */}
      <path 
        d="M2 7.5 L2 14.5 L14.5 14.5 L14.5 6 L18 6 L18 7 L15.5 7.5 L14.5 8 L2 7.5 Z" 
        fill="currentColor" 
        fillOpacity="0.15" 
      />
      <path d="M2 7.5 L14.5 7.5 L17.5 7 L17.5 6 L14.5 6 L14.5 14.5 L2 14.5 L2 7.5 Z" />
      
      {/* Tipper Body Reinforcement Ribs (Heavy load structural pillars) */}
      <line x1="5.5" y1="8" x2="5.5" y2="14" />
      <line x1="9" y1="8" x2="9" y2="14" />
      <line x1="12.5" y1="8" x2="12.5" y2="14" />
      
      {/* Hydraulic Lift Ram Cylinder under front of tipper */}
      <line x1="12.5" y1="14.5" x2="14" y2="16.5" />

      {/* Heavy Commercial Cabin (Cab Over Engine) */}
      <path d="M14.5 9 L18.5 9 Q20.5 9 21.5 11 L22.5 14 L22.5 16.5 L14.5 16.5" />
      
      {/* Cabin Windshield Glass */}
      <path d="M16 10 L18.5 10 L20.2 13 L16 13 Z" fill="currentColor" fillOpacity="0.25" />

      {/* Heavy Steel Front Bumper & Headlight */}
      <path d="M21.5 16.5 L23 16.5 L23 17.5 L20.5 17.5" />
      <circle cx="21.8" cy="15" r="0.6" fill="currentColor" />

      {/* Chassis Base Rail */}
      <line x1="2" y1="16.5" x2="14.5" y2="16.5" />

      {/* Rear Tandem Wheels (Heavy Load Axles 1 & 2) */}
      <circle cx="4.5" cy="18.5" r="2.2" />
      <circle cx="4.5" cy="18.5" r="0.8" fill="currentColor" />
      <circle cx="9.5" cy="18.5" r="2.2" />
      <circle cx="9.5" cy="18.5" r="0.8" fill="currentColor" />

      {/* Front Steering Wheel */}
      <circle cx="18.5" cy="18.5" r="2.2" />
      <circle cx="18.5" cy="18.5" r="0.8" fill="currentColor" />
    </svg>
  );
};
