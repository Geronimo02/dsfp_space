import { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen && !isScanning) {
      setIsScanning(true);
      
      const scanner = new Html5QrcodeScanner(
        "barcode-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          onScan(decodedText);
          setIsOpen(false);
          scanner.clear();
          setIsScanning(false);
        },
        (error) => {
          // Silent error handling for scanning
        }
      );

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
        setIsScanning(false);
      }
    };
  }, [isOpen, onScan]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
      setIsScanning(false);
    }
    setIsOpen(false);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline" size="sm">
        <Camera className="h-4 w-4 mr-2" />
        Escanear
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escanear Código de Barras</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div id="barcode-reader" className="w-full"></div>
            <Button onClick={handleClose} variant="outline" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
