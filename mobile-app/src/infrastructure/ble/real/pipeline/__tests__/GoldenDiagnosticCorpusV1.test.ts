import { ElmNormalizer } from '../ElmNormalizer';
import { ElmClassifier } from '../ElmClassifier';
import { ObdFrameParser } from '../ObdFrameParser';
import { ObdDecoder } from '../ObdDecoder';
import {
  GOLDEN_DIAGNOSTIC_CORPUS_V1,
  GOLDEN_DIAGNOSTIC_CORPUS_VERSION
} from '../golden/GoldenDiagnosticCorpusV1';
import { CommandRequest, RawElmResponse } from '../types';

describe(`Golden Diagnostic Corpus ${GOLDEN_DIAGNOSTIC_CORPUS_VERSION}`, () => {
  it.each(GOLDEN_DIAGNOSTIC_CORPUS_V1)('$id', fixture => {
    const request: CommandRequest = {
      id: fixture.id,
      command: fixture.command,
      family: fixture.family,
      expectedService: fixture.expectedService,
      expectedPid: fixture.command.length === 4 ? fixture.command.slice(2) : undefined,
      timeoutMs: 1500
    };
    const raw: RawElmResponse = {
      fragments: [],
      accumulatedText: fixture.rawText,
      completionReason: 'PROMPT_RECEIVED',
      startedAt: 1,
      finishedAt: 2,
      latencyMs: 1
    };

    const normalized = ElmNormalizer.normalize(raw, request.command);
    const classified = ElmClassifier.classify(normalized, request);
    const { frames, negatives } = ObdFrameParser.parse(classified, request);
    const decoded = ObdDecoder.decode(frames);

    expect(frames.filter(frame => frame.validity === 'VALID')).toHaveLength(
      fixture.expected.validFrames
    );
    expect(frames.filter(frame => frame.validity === 'AMBIGUOUS')).toHaveLength(
      fixture.expected.ambiguousFrames ?? 0
    );
    expect(negatives).toHaveLength(fixture.expected.negativeResponses);

    if (fixture.expected.decodedType) {
      expect(decoded).toContainEqual(expect.objectContaining({
        type: fixture.expected.decodedType,
        value: fixture.expected.decodedValue
      }));
      expect(frames.find(frame => frame.validity === 'VALID')?.sourceAddress)
        .toBe(fixture.expected.sourceEcu);
    } else {
      expect(decoded).toHaveLength(0);
    }
  });
});
