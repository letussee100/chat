"use client"

import { useState } from "react"
import { useCrypto } from "@/hooks/use-crypto"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Shield, Key, Download, Upload, AlertTriangle } from "lucide-react"

export function SecuritySettings() {
  const { isReady, publicKeyExport, exportKey, importKey, encryptionKey, clearKeys, initializeKeys } = useCrypto()
  const [importValue, setImportValue] = useState("")
  const [exportValue, setExportValue] = useState("")

  const handleExport = async () => {
    if (!encryptionKey || !exportKey) return

    const exported = await exportKey(encryptionKey)
    setExportValue(exported)
  }

  const handleImport = async () => {
    if (!importKey || !importValue) return

    try {
      await importKey(importValue)
      setImportValue("")
      alert("Key imported successfully!")
    } catch (error) {
      alert("Failed to import key. Please check the format.")
    }
  }

  const handleReset = async () => {
    await clearKeys()
    await initializeKeys()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Encryption Active</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your messages are encrypted using AES-256-GCM. Keys are stored locally in your browser.
          </p>
        </div>
      </div>

      {isReady && (
        <>
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4" />
              Your Public Key
            </Label>
            <Input value={publicKeyExport || ""} readOnly className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground mt-1">Share this with others to verify your identity.</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4" />
                Export Encryption Key
              </Label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport}>
                  Export Key
                </Button>
              </div>
              {exportValue && (
                <div className="mt-2">
                  <Input value={exportValue} readOnly className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Save this key securely. Anyone with this key can decrypt your messages.
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4" />
                Import Encryption Key
              </Label>
              <div className="flex gap-2">
                <Input
                  value={importValue}
                  onChange={(e) => setImportValue(e.target.value)}
                  placeholder="Paste your encryption key..."
                  className="font-mono text-xs"
                />
                <Button variant="outline" onClick={handleImport}>
                  Import
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Reset Encryption Keys
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset encryption keys?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will generate new encryption keys. You will no longer be able to decrypt old messages. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Reset Keys</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  )
}
