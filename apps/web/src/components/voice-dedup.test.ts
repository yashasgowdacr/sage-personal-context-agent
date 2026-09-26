import { normalizeText, appendFinalTranscript, combineInput } from './ChatInput';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('=== SAGE VOICE DEDUPLICATION TEST SUITE ===\n');

// Test 1: "Schedule an appointment" - Single phrase, simulating interim results followed by final result
{
  console.log('--- TEST 1: Say "Schedule an appointment" (Not duplicated) ---');
  // Interim updates:
  let interim = 'Schedule';
  let finalTr = '';
  let speech = [finalTr, interim].filter(Boolean).join(' ').trim();
  assert(speech === 'Schedule', 'Step 1: Interim shows "Schedule"');

  interim = 'Schedule an';
  speech = [finalTr, interim].filter(Boolean).join(' ').trim();
  assert(speech === 'Schedule an', 'Step 2: Interim replaces to "Schedule an"');

  interim = 'Schedule an appointment';
  speech = [finalTr, interim].filter(Boolean).join(' ').trim();
  assert(speech === 'Schedule an appointment', 'Step 3: Interim replaces to "Schedule an appointment"');

  // Final event:
  finalTr = appendFinalTranscript(finalTr, 'Schedule an appointment');
  interim = '';
  speech = [finalTr, interim].filter(Boolean).join(' ').trim();
  assert(speech === 'Schedule an appointment', 'Step 4: Final is "Schedule an appointment"');

  // Browser re-emits final event (duplicate onresult event):
  finalTr = appendFinalTranscript(finalTr, 'Schedule an appointment');
  speech = [finalTr, interim].filter(Boolean).join(' ').trim();
  const input = combineInput('', speech);
  assert(input === 'Schedule an appointment', 'Step 5: Output is exactly "Schedule an appointment" (NOT duplicated)');
}

// Test 2: "Schedule an appointment with a doctor" - Exactly once
{
  console.log('\n--- TEST 2: Say "Schedule an appointment with a doctor" (Exactly once) ---');
  let finalTr = '';
  // Emitting whole utterance
  finalTr = appendFinalTranscript(finalTr, 'Schedule an appointment with a doctor');
  // Simulating possible duplicate final event:
  finalTr = appendFinalTranscript(finalTr, 'Schedule an appointment with a doctor');
  const input = combineInput('', finalTr);
  assert(input === 'Schedule an appointment with a doctor', 'Test 2 produces exactly once without duplication');
}

// Test 3: Say slowly: "Schedule ... an ... appointment" - Not repeated words
{
  console.log('\n--- TEST 3: Say slowly "Schedule ... an ... appointment" (Not repeated words) ---');
  let finalTr = '';
  // Chunk 1 final
  finalTr = appendFinalTranscript(finalTr, 'Schedule');
  assert(finalTr === 'Schedule', 'Chunk 1 committed: "Schedule"');

  // Chunk 2 final
  finalTr = appendFinalTranscript(finalTr, 'an');
  assert(finalTr === 'Schedule an', 'Chunk 2 committed: "Schedule an"');

  // Chunk 3 final
  finalTr = appendFinalTranscript(finalTr, 'appointment');
  assert(finalTr === 'Schedule an appointment', 'Chunk 3 committed: "Schedule an appointment"');

  const input = combineInput('', finalTr);
  assert(input === 'Schedule an appointment', 'Test 3 produces clean "Schedule an appointment" without repetition');
}

// Test 4: "Schedule an appointment with a doctor tomorrow at five PM" - Exactly once
{
  console.log('\n--- TEST 4: "Schedule an appointment with a doctor tomorrow at five PM" ---');
  let finalTr = '';
  finalTr = appendFinalTranscript(finalTr, 'Schedule an appointment with a doctor tomorrow at five PM');
  // Duplicate emission prevention
  finalTr = appendFinalTranscript(finalTr, 'Schedule an appointment with a doctor tomorrow at five PM');
  const input = combineInput('', finalTr);
  assert(
    input === 'Schedule an appointment with a doctor tomorrow at five PM',
    'Test 4 produces full sentence exactly once'
  );
}

// Test 5: Type "Please " then speak "schedule an appointment"
{
  console.log('\n--- TEST 5: Type "Please " then speak "schedule an appointment" ---');
  const baseInput = 'Please ';
  const speech = 'schedule an appointment';
  const combined = combineInput(baseInput, speech);
  assert(
    combined === 'Please schedule an appointment',
    `Test 5 produces "Please schedule an appointment" (got "${combined}")`
  );

  // Also test without trailing space: "Please"
  const baseInputNoSpace = 'Please';
  const combinedNoSpace = combineInput(baseInputNoSpace, speech);
  assert(
    combinedNoSpace === 'Please schedule an appointment',
    `Test 5 (no trailing space) produces "Please schedule an appointment"`
  );
}

// Test 6: Start microphone, speak one sentence, stop microphone, then start microphone again
{
  console.log('\n--- TEST 6: Multi-session recognition (Second session must not duplicate first) ---');
  // Session 1:
  let baseInput = '';
  let finalTr1 = appendFinalTranscript('', 'Schedule an appointment');
  let session1Result = combineInput(baseInput, finalTr1);
  assert(session1Result === 'Schedule an appointment', 'Session 1 result is "Schedule an appointment"');

  // Session 2 starts: base input is now session1Result
  baseInput = session1Result;
  let finalTr2 = appendFinalTranscript('', 'with a doctor');
  let session2Result = combineInput(baseInput, finalTr2);
  assert(
    session2Result === 'Schedule an appointment with a doctor',
    `Session 2 appends cleanly: "${session2Result}" (Session 1 not duplicated)`
  );

  // Session 2 edge case: if speech engine mistakenly repeated the entire previous text:
  let repeatedSpeech = 'Schedule an appointment with a doctor';
  let safeCombined = combineInput(baseInput, repeatedSpeech);
  assert(
    safeCombined === 'Schedule an appointment with a doctor',
    `Session 2 with engine re-emission deduplicated: "${safeCombined}"`
  );
}

// Test 7: Speak one sentence and allow recognition to end naturally
{
  console.log('\n--- TEST 7: Recognition ends naturally (One transcript only) ---');
  let baseInput = '';
  let finalTr = appendFinalTranscript('', 'Schedule an appointment');
  // onend commits final transcript
  let finalOutput = combineInput(baseInput, finalTr);
  assert(finalOutput === 'Schedule an appointment', 'Test 7 commits exactly one transcript on natural end');
}

// Additional Edge Cases: Word overlap and case-insensitive duplicates
{
  console.log('\n--- ADDITIONAL EDGE CASES: Overlaps and Case Normalization ---');
  // Overlapping word boundary: "Schedule an" + "an appointment"
  let overlapResult = appendFinalTranscript('Schedule an', 'an appointment');
  assert(overlapResult === 'Schedule an appointment', `Word overlap resolved: "${overlapResult}"`);

  // Partial superset: "Schedule an" + "Schedule an appointment"
  let supersetResult = appendFinalTranscript('Schedule an', 'Schedule an appointment');
  assert(supersetResult === 'Schedule an appointment', `Superset replaced: "${supersetResult}"`);

  // Case normalization duplicate
  let caseResult = appendFinalTranscript('Schedule an appointment', 'schedule an appointment');
  assert(caseResult === 'Schedule an appointment', `Case variation deduplicated: "${caseResult}"`);
}

console.log('\n🏆 ALL 7 VOICE DEDUPLICATION TEST CASES PASSED!');
