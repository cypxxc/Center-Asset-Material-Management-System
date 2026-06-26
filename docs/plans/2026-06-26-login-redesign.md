# Design Document: Frosted Glassmorphism Login Page Redesign

## Context & Objectives
The login page of the Office Item Registry (Registry-S) application was previously styled using a dark zinc theme that clashed with the primary light-mode slate/blue theme of the main dashboard. 

The goal of this redesign is to deliver a premium, visually stunning login experience that aligns perfectly with the system's light slate theme, using frosted glassmorphic card containers, modern typography, background animations, and enhanced user interactions (quick-fill profile chips and password visibility togglers).

## Design Specification

### 1. Visual Aesthetics
* **Theme**: Light Mode, Slate & Charcoal/Indigo accent tones.
* **Containers**: Centered frosted-glass card (`bg-white/70 backdrop-blur-md border border-white/50 shadow-2xl`).
* **Background Decoration**:
  * Outer page background in `bg-slate-50`.
  * Grid overlay (`bg-[radial-gradient(#e2e8f0_1px,transparent_1px)]`).
  * Smooth, drifting ambient background blobs (`bg-blue-400/10` and `bg-indigo-400/10`).
* **Micro-interactions**: Hover expansions, smooth focus transitions, active button press scaling.

### 2. User Experience Improvements
* **Quick Access Profile Cards**:
  * Round avatar badges with distinct icons representing Roles (`Shield` for Admin, `User` for Staff, `Eye` for Viewer).
  * Direct state updating: clicking a profile chip automatically fills in the corresponding email and password.
* **Password Toggle**:
  * Action button to reveal or mask passwords.
* **Alert States**:
  * Custom rose-themed alert container with clear, human-readable Thai error notifications.

### 3. Architecture & Code Layout
* **Path**: `app/(auth)/login/page.tsx`
* **Form Submission**: Leverages Next.js Server Actions (`login` action) with React `useActionState` to handle form validation and pending states safely.
* **Dependencies**: Uses `lucide-react` for system icons, `@/components/ui/button` for core buttons, and `@/lib/utils` for CSS class-name joining (`cn`).
