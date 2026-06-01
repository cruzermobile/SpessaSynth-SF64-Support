import { Ut } from "./other.ts";

export interface MIDIFile {
    binary: ArrayBuffer;
    fileName: string;
}

export class DropFileHandler {
    /**
     * Creates a new handler for handling file dropping into the app
     */
    public constructor(
        midiCallback: (arg0: MIDIFile[]) => unknown,
        soundFontCallback: (arg0: ArrayBuffer | Blob) => unknown
    ) {
        const dragPrompt = document.querySelectorAll(".drop_prompt")[0];
        document.body.addEventListener("dragover", (e) => {
            e.preventDefault();
            Ut.show(dragPrompt);
        });
        document.body.addEventListener("dragend", () => {
            Ut.hide(dragPrompt);
        });

        document.body.addEventListener(
            "drop",
            (e) =>
                void (async (e) => {
                    e.preventDefault();
                    Ut.hide(dragPrompt);
                    if (!e.dataTransfer?.files[0]) {
                        return;
                    }

                    const MIDIFiles: MIDIFile[] = [];

                    for (const file of e.dataTransfer.files) {
                        const name = file.name;
                        const headerBuffer = await file.slice(0, 12).arrayBuffer();
                        // Identify the file
                        const decoder = new TextDecoder();
                        const magic = decoder.decode(headerBuffer.slice(0, 4));
                        if (magic === "SF64") {
                            soundFontCallback(file);
                            continue;
                        }
                        const buf = await file.arrayBuffer();
                        // Check for RIFF
                        if (magic === "RIFF") {
                            // Riff, check if RMID, otherwise soundfont
                            const rmid = buf.slice(8, 12);
                            if (decoder.decode(rmid) === "RMID") {
                                // RMID
                                MIDIFiles.push({ binary: buf, fileName: name });
                                continue;
                            }
                            // Soundfont
                            soundFontCallback(buf);
                            continue;
                        }
                        // Midi
                        MIDIFiles.push({ binary: buf, fileName: name });
                    }
                    midiCallback(MIDIFiles);
                })(e)
        );
    }
}
