/** Entrega um Blob como arquivo para o navegador salvar. */
export function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome do arquivo que o servidor mandou no Content-Disposition (ou um padrão). */
export function fileNameFrom(disposition: string | undefined, fallback: string): string {
  const match = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  return match?.[1] ?? fallback;
}
