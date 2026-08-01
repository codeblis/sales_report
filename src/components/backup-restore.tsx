"use client";

import { useActionState, useRef, useState } from "react";

import { restoreBackup } from "@/actions/backup";
import { exportJson } from "@/lib/export";

export function BackupRestore({ backup }: { backup: string }) {
  const [state, formAction, pending] = useActionState(restoreBackup, {});
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState("");
  const [fileName, setFileName] = useState("");

  function leerArchivo(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setData(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card-h">
        <div>
          <h3>Descargar respaldo</h3>
          <div className="sub">
            Todo el negocio en un archivo JSON (vendedores, mercancía, ventas y cuentas)
          </div>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => exportJson(`respaldo-${new Date().toISOString().slice(0, 10)}`, JSON.parse(backup))}
        >
          Descargar respaldo
        </button>
      </div>

      <div className="card-h">
        <div>
          <h3>Restaurar respaldo</h3>
          <div className="sub">
            Reemplaza todos los datos actuales por los del respaldo. Se mantiene tu PIN de administrador.
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) leerArchivo(f);
          }}
        />
        <button className="btn btn-ghost" type="button" onClick={() => fileRef.current?.click()}>
          Elegir archivo
        </button>
      </div>

      {data && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="data" value={data} />
          <p className="notice">
            Vas a restaurar <b>{fileName}</b>. Se borrarán los datos actuales. Escribe <b>CONFIRMAR</b> para
            continuar:
          </p>
          <input
            className="input"
            name="confirm"
            placeholder="CONFIRMAR"
            autoComplete="off"
            maxLength={20}
            required
          />
          {state?.error && (
            <p className="notice" role="alert">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p className="notice" role="status">
              <b>Respaldo restaurado.</b>
            </p>
          )}
          <div>
            <button className="btn btn-solid btn-danger" type="submit" disabled={pending}>
              Restaurar respaldo
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
