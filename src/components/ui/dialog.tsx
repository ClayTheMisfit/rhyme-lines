'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'
import { layers } from '@/lib/layers'

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cx('fixed inset-0 bg-black/60 backdrop-blur-sm', className)}
    style={{ zIndex: layers.modalBackdrop }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cx('fixed pointer-events-auto', className)}
    style={{ zIndex: layers.modalContent }}
    {...props}
  />
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTrigger }
