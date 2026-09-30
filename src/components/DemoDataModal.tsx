import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { doc, setDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { CivicIssue } from '../types.ts';
import {
  Sparkles,
  X,
  Check,
  Trash2,
  AlertCircle,
  Database,
  Calendar,
  Layers
} from 'lucide-react';

interface DemoDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const DemoDataModal: React.FC<DemoDataModalProps> = ({ isOpen, onClose, onDataChanged }) => {
  const { user } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // The 5 specified realistic scenarios with historical dates spanning previous months
  const demoIssues: Omit<CivicIssue, 'ownerId'>[] = [
    {
      issueId: 'demo_streetlight_school_01',
      title: 'Broken Streetlight Near Primary School Gate',
      description: 'The street light pole #L-42 situated right opposite the main gate of St. Mary Public School has been dark for 9 nights. School children attending late remedial classes and evening sports cross in pitch darkness. Parents are deeply worried about safety given heavy evening vehicle traffic on Baner Road.',
      location: 'Baner Road, Opposite St. Mary School Gate #2, Pune',
      category: 'Public Safety',
      severity: 'High',
      urgency: 'High',
      impact: 'Approximately 450 school children, evening pedestrians, and cyclists crossing Baner Road',
      summary: 'Critical street lighting failure directly adjacent to school entrance causing evening pedestrian hazard.',
      recommendedAction: 'Dispatch electrical works crew to replace high-pressure sodium bulb and inspect line transformer #T-12.',
      priorityScore: 78,
      aiConfidence: 0.94,
      status: 'Open',
      createdAt: '2025-09-08T18:30:00.000Z',
      updatedAt: '2025-09-08T18:30:00.000Z',
      aiAnalyzedAt: '2025-09-08T18:30:05.000Z',
      isDemo: true,
    },
    {
      issueId: 'demo_garbage_delay_02',
      title: 'Bi-Weekly Municipal Garbage Collection Delay',
      description: 'Scheduled wet and dry waste collection trucks have not serviced Sector 4 for 6 consecutive days. Solid waste bins are overflowing onto the sidewalks, attracting stray animals and emitting strong foul odors near the community health center and vegetable market.',
      location: 'Sector 4 Market Square, Near Community Health Clinic, Pune',
      category: 'Sanitation',
      severity: 'Medium',
      urgency: 'High',
      impact: 'Over 800 local residential households and 40 retail merchant storefronts',
      summary: 'Uncollected domestic and commercial waste accumulating near public health facility.',
      recommendedAction: 'Direct secondary zonal compactor truck #SC-8 to execute immediate emergency clearance.',
      priorityScore: 64,
      aiConfidence: 0.91,
      status: 'In Progress',
      createdAt: '2025-09-14T09:15:00.000Z',
      updatedAt: '2025-09-15T11:00:00.000Z',
      aiAnalyzedAt: '2025-09-14T09:15:10.000Z',
      isDemo: true,
    },
    {
      issueId: 'demo_damaged_road_pothole_03',
      title: 'Deep Hazardous Pothole and Asphalt Collapse',
      description: 'A 2-foot deep trench-like pothole has opened up following recent monsoon runoff on the westbound lane of University Road. Multiple two-wheelers have skidded, and several cars suffered wheel rim damage. It is nearly invisible during night rain.',
      location: 'University Road, 100 meters before Central Flyover, Pune',
      category: 'Infrastructure',
      severity: 'Critical',
      urgency: 'Critical',
      impact: 'Thousands of daily two-wheeler commuters and city bus transport routes',
      summary: 'Dangerous structural crater on arterial road causing immediate vehicular accidents.',
      recommendedAction: 'Deploy emergency asphalt cold-mix crew; install high-visibility reflective barricades immediately.',
      priorityScore: 92,
      aiConfidence: 0.96,
      status: 'In Progress',
      createdAt: '2025-09-21T07:45:00.000Z',
      updatedAt: '2025-09-22T08:30:00.000Z',
      aiAnalyzedAt: '2025-09-21T07:45:12.000Z',
      isDemo: true,
      playbook: {
        targetResolutionTime: '12-24 Hours (Immediate Hazard)',
        leadDepartment: 'Department of Public Works (Roads & Bridges)',
        collaboratingDepartments: ['Traffic Police Division', 'Emergency Rapid Response Unit'],
        requiredEquipmentAndResources: ['Asphalt Roller', 'Cold-Mix Bitumen Truck', 'LED Traffic Cones', 'Reflective Hazard Tape'],
        safetyProtocols: ['Divert westbound lane traffic with police assistance', 'Deploy illuminated hazard signs 50m upstream'],
        mitigationSteps: ['Excavate loose sub-base', 'Apply rapid curing tack coat', 'Compact asphalt layer flush with grade'],
        publicTransparencyNotice: 'OFFICIAL CIVIC NOTICE: The Department of Public Works has mobilized road resurfacing units to University Road for emergency crater repair. One westbound lane is temporarily diverted. Work will complete by 18:00 hrs. We appreciate your patience.',
        generatedAt: '2025-09-22T08:30:00.000Z',
      }
    },
    {
      issueId: 'demo_water_leak_pipe_04',
      title: 'Underground Drinking Water Pipeline Burst',
      description: 'Major pressurized potable water pipeline has ruptured beneath the pedestrian walkway. Clean drinking water is gushing onto the avenue at high velocity, flooding three commercial basements and eroding soil underneath the paved pedestrian path.',
      location: 'Kothrud Main Avenue, Junction with Mahatma Gandhi Road, Pune',
      category: 'Infrastructure',
      severity: 'Critical',
      urgency: 'Critical',
      impact: 'Complete loss of drinking water supply to Ward 11 (est. 12,000 residents) and basement flood risk',
      summary: 'High-pressure potable water pipeline rupture causing severe flooding and service disruption.',
      recommendedAction: 'Isolate Sector Valve #V-09; dispatch emergency hydraulic pipe weld and excavation crew.',
      priorityScore: 89,
      aiConfidence: 0.95,
      status: 'Resolved',
      createdAt: '2025-09-25T14:20:00.000Z',
      updatedAt: '2025-09-26T16:00:00.000Z',
      resolvedAt: '2025-09-26T16:00:00.000Z',
      aiAnalyzedAt: '2025-09-25T14:20:08.000Z',
      isDemo: true,
    },
    {
      issueId: 'demo_unsafe_crossing_05',
      title: 'Unsafe Pedestrian Crossing & Missing Zebra Striping',
      description: 'The pedestrian crossing between the city transit terminal and the Senior Citizen Cultural Center has completely faded away. Vehicles turn rapidly without yielding, creating an extreme hazard for elderly pedestrians and disabled citizens attempting to board public buses.',
      location: 'City Transit Terminal West Gate, Pune',
      category: 'Transportation',
      severity: 'High',
      urgency: 'Medium',
      impact: 'Elderly citizens, public transit passengers, and daily pedestrians crossing terminal gates',
      summary: 'Faded pedestrian walkway markings and lack of traffic calming creating transit terminal collision hazard.',
      recommendedAction: 'Paint thermoplastic reflective pedestrian zebra crossing; install raised pedestrian tabletop ramp.',
      priorityScore: 71,
      aiConfidence: 0.89,
      status: 'Open',
      createdAt: '2025-09-28T11:00:00.000Z',
      updatedAt: '2025-09-28T11:00:00.000Z',
      aiAnalyzedAt: '2025-09-28T11:00:15.000Z',
      isDemo: true,
    },
  ];

  const handleSeedDemoData = async () => {
    setSeeding(true);
    setStatusMsg(null);
    const ownerUid = user?.uid || 'demo_officer_account';

    try {
      for (const item of demoIssues) {
        const fullIssue: CivicIssue = {
          ...item,
          ownerId: ownerUid,
          ownerEmail: 'demo-citizen@civiclens.gov',
        };
        await setDoc(doc(db, 'issues', item.issueId), fullIssue);
      }

      setStatusMsg('Successfully seeded 5 realistic historical civic reports!');
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      console.error(err);
      setStatusMsg('Error seeding data: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleClearDemoData = async () => {
    setClearing(true);
    setStatusMsg(null);
    try {
      const q = query(collection(db, 'issues'), where('isDemo', '==', true));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      setStatusMsg(`Removed ${snap.size} demo records from database.`);
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      console.error(err);
      setStatusMsg('Error clearing demo data: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-zinc-900">CivicLens AI Demo Data Engine</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed">
          Populate realistic municipal governance scenarios to demonstrate <strong>Historical Search</strong> (e.g., September 2025 date range), <strong>Civic Trend Lens</strong>, and <strong>Priority Scoring</strong>.
        </p>

        {/* Demo Scenarios List */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
          <span className="font-bold text-zinc-700 block text-[11px] uppercase tracking-wider">
            Included Scenarios (Clearly tagged [DEMO DATA]):
          </span>
          <ul className="space-y-1 text-zinc-600">
            <li>1. Broken streetlight near a school (Public Safety)</li>
            <li>2. Garbage collection delay in Market Square (Sanitation)</li>
            <li>3. Damaged road / hazardous crater (Transportation / Infrastructure)</li>
            <li>4. Potable water pipeline burst (Infrastructure / Environment)</li>
            <li>5. Unsafe pedestrian crossing at transit terminal (Transportation)</li>
          </ul>
        </div>

        {statusMsg && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs p-3 rounded-xl flex items-center space-x-2">
            <Check className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleClearDemoData}
            disabled={clearing || seeding}
            className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{clearing ? 'Clearing...' : 'Clear Demo Records'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl"
            >
              Close
            </button>
            <button
              onClick={handleSeedDemoData}
              disabled={seeding || clearing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Database className="w-4 h-4" />
              <span>{seeding ? 'Seeding...' : 'Seed 5 Scenarios'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
