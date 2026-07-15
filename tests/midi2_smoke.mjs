import assert from "node:assert/strict";
import { BasicMIDI, MIDIChannel, MIDIMessageTypes } from "spessasynth_core";

const textEncoder = new TextEncoder();

function wordBytes(words) {
    const bytes = new Uint8Array(words.length * 4);
    let index = 0;
    for (const word of words) {
        bytes[index++] = (word >>> 24) & 0xff;
        bytes[index++] = (word >>> 16) & 0xff;
        bytes[index++] = (word >>> 8) & 0xff;
        bytes[index++] = word & 0xff;
    }
    return bytes;
}

function packet(...words) {
    return wordBytes(words);
}

function concat(...arrays) {
    const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) {
        out.set(arr, offset);
        offset += arr.length;
    }
    return out.buffer;
}

function utility(status, value) {
    return packet((status << 20) | value);
}

function dctpq(ticksPerQuarter) {
    return utility(3, ticksPerQuarter);
}

function dcs(ticks) {
    return utility(4, ticks);
}

function midi2ChannelVoice(group, status, index, byte4, data32) {
    return packet(
        (0x4 << 28) | (group << 24) | (status << 16) | (index << 8) | byte4,
        data32 >>> 0
    );
}

function midi1UMP(group, status, data1, data2) {
    return packet(
        (0x2 << 28) | (group << 24) | (status << 16) | (data1 << 8) | data2
    );
}

const clipBuffer = concat(
    textEncoder.encode("SMF2CLIP"),
    dctpq(480),
    dcs(0),
    packet(0xd << 28, 50_000_000, 0, 0),
    dcs(0),
    midi2ChannelVoice(1, 0xc0, 0, 1, (5 << 24) | (2 << 8) | 3),
    dcs(0),
    midi2ChannelVoice(1, 0x90, 60, 0, 0x8000 << 16),
    dcs(240),
    midi2ChannelVoice(1, 0x60, 60, 0, 0xc0000000),
    dcs(240),
    midi2ChannelVoice(1, 0x80, 60, 0, 0x4000 << 16),
    packet((0xf << 28) | (0x21 << 16), 0, 0, 0)
);

const clip = BasicMIDI.fromArrayBuffer(clipBuffer, "synthetic.midi2");
assert.equal(clip.sourceFormat, "midi2-clip");
assert.equal(clip.isMIDI2, true);
assert.equal(clip.timeDivision, 480);
assert.equal(clip.midi2ChannelCount, 17);
assert.equal(Math.round(clip.duration), 1);

const noteOn = clip.tracks[0].events.find(
    (event) => (event.statusByte & 0xf0) === MIDIMessageTypes.noteOn
);
assert.ok(noteOn);
assert.equal(noteOn.midi2.kind, "noteOn");
assert.equal(noteOn.midi2.channel, 16);
assert.equal(noteOn.midi2.velocity, 0x8000);
assert.equal(noteOn.data[1], 64);

const perNoteBend = clip.tracks[0].events.find(
    (event) => event.midi2?.kind === "perNotePitchBend"
);
assert.ok(perNoteBend);
assert.equal(perNoteBend.midi2.note, 60);
assert.equal(perNoteBend.midi2.channel, 16);
assert.equal(perNoteBend.data[1] << 7 | perNoteBend.data[0], 12_288);

const syntheticSoundBank = {
    getPreset(patch) {
        return { ...patch, isDrum: patch.isGMGSDrum, name: "Synthetic" };
    }
};
const usedPrograms = clip.getUsedProgramsAndKeys(syntheticSoundBank);
assert.equal(usedPrograms.size, 1);

const rawUMPBuffer = concat(
    dctpq(240),
    dcs(0),
    midi1UMP(2, 0x93, 64, 100),
    dcs(120),
    packet((0x3 << 28) | (2 << 24) | (0 << 20) | (3 << 16) | (0x7e << 8) | 0x7f, 0x09000000),
    dcs(120),
    midi1UMP(2, 0x83, 64, 0)
);

const raw = BasicMIDI.fromArrayBuffer(rawUMPBuffer, "capture.ump");
assert.equal(raw.sourceFormat, "ump");
assert.equal(raw.isMIDI2, true);
assert.equal(raw.timeDivision, 240);
assert.equal(raw.midi2ChannelCount, 36);

const rawNote = raw.tracks[0].events.find(
    (event) => (event.statusByte & 0xf0) === MIDIMessageTypes.noteOn
);
assert.ok(rawNote);
assert.equal(rawNote.midi2.kind, "midi1ChannelVoice");
assert.equal(rawNote.midi2.channel, 35);
assert.equal(rawNote.data[1], 100);

const sysex = raw.tracks[0].events.find(
    (event) => event.statusByte === MIDIMessageTypes.systemExclusive
);
assert.ok(sysex);
assert.deepEqual([...sysex.data], [0x7e, 0x7f, 0x09, 0xf7]);

const patchlessChannel = Object.create(MIDIChannel.prototype);
patchlessChannel.setPatch(undefined);

console.log("MIDI 2.0 smoke fixtures passed.");
