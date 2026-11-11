// =============================================
// NOIZYVOX UNITY SDK v1.0.0
// Assets/Noizyvox/Runtime/NoizyvoxSDK.cs
// =============================================

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Noizyvox.Unity
{
    #region Configuration
    
    [CreateAssetMenu(fileName = "NoizyvoxConfig", menuName = "Noizyvox/Configuration")]
    public class NoizyvoxConfig : ScriptableObject
    {
        [Header("API Configuration")]
        public string apiKey;
        public string baseUrl = "https://api.noizyvox.ai/v1";
        public float timeoutSeconds = 30f;
        
        [Header("Default Persona")]
        public string defaultPersonaId;
        
        [Header("Audio Settings")]
        public int sampleRate = 48000;
        public int channels = 1;
        public AudioFormat outputFormat = AudioFormat.WAV;
        
        [Header("Streaming")]
        public bool enableStreaming = true;
        public int streamBufferMs = 200;
        
        [Header("Caching")]
        public bool enableCache = true;
        public int maxCacheSizeMB = 100;
        public int cacheExpirationHours = 24;
        
        [Header("Watermarking")]
        public bool includeWatermark = true;
    }
    
    public enum AudioFormat { WAV, MP3, OGG }
    
    #endregion
    
    #region Core Client
    
    public class NoizyvoxClient : IDisposable
    {
        private readonly NoizyvoxConfig _config;
        private readonly Dictionary<string, AudioClip> _cache;
        private bool _disposed;
        
        public NoizyvoxClient(NoizyvoxConfig config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _cache = new Dictionary<string, AudioClip>();
        }
        
        /// <summary>
        /// Synthesize speech from text
        /// </summary>
        public async Task<SynthesisResult> SynthesizeAsync(SynthesisRequest request)
        {
            ValidateRequest(request);
            
            string cacheKey = GenerateCacheKey(request);
            if (_config.enableCache && _cache.TryGetValue(cacheKey, out AudioClip cached))
            {
                return new SynthesisResult { AudioClip = cached, FromCache = true };
            }
            
            var response = await PostAsync<SynthesisResponse>("/personas/{personaId}/synthesize", request);
            
            AudioClip clip = await DownloadAudioClipAsync(response.AudioUrl);
            
            if (_config.enableCache)
            {
                _cache[cacheKey] = clip;
            }
            
            return new SynthesisResult
            {
                AudioClip = clip,
                DurationSeconds = response.DurationSeconds,
                CharactersUsed = response.CharactersUsed,
                WatermarkId = response.WatermarkId,
                Timestamps = response.Timestamps,
                Visemes = response.Visemes,
                FromCache = false
            };
        }
        
        /// <summary>
        /// Stream synthesis for real-time playback
        /// </summary>
        public async IAsyncEnumerable<AudioChunk> StreamAsync(SynthesisRequest request)
        {
            ValidateRequest(request);
            
            using var ws = new NoizyvoxWebSocket(_config);
            await ws.ConnectAsync($"/personas/{request.PersonaId}/stream");
            
            await ws.SendAsync(request);
            
            await foreach (var chunk in ws.ReceiveChunksAsync())
            {
                yield return chunk;
            }
        }
        
        /// <summary>
        /// Get available personas
        /// </summary>
        public async Task<List<PersonaSummary>> GetPersonasAsync(PersonaFilter filter = null)
        {
            var query = filter?.ToQueryString() ?? "";
            return await GetAsync<List<PersonaSummary>>($"/personas{query}");
        }
        
        /// <summary>
        /// Get persona details
        /// </summary>
        public async Task<PersonaPack> GetPersonaAsync(string personaId)
        {
            return await GetAsync<PersonaPack>($"/personas/{personaId}");
        }
        
        /// <summary>
        /// Get license usage
        /// </summary>
        public async Task<LicenseUsage> GetUsageAsync()
        {
            return await GetAsync<LicenseUsage>("/licenses/usage");
        }
        
        #region HTTP Helpers
        
        private async Task<T> GetAsync<T>(string endpoint)
        {
            string url = _config.baseUrl + endpoint;
            
            using var request = UnityWebRequest.Get(url);
            request.SetRequestHeader("Authorization", $"Bearer {_config.apiKey}");
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = (int)_config.timeoutSeconds;
            
            await request.SendWebRequest();
            
            if (request.result != UnityWebRequest.Result.Success)
            {
                throw new NoizyvoxException(request.error, request.responseCode);
            }
            
            return JsonUtility.FromJson<T>(request.downloadHandler.text);
        }
        
        private async Task<T> PostAsync<T>(string endpoint, object body)
        {
            string url = _config.baseUrl + endpoint;
            string json = JsonUtility.ToJson(body);
            
            using var request = new UnityWebRequest(url, "POST");
            request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(json));
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Authorization", $"Bearer {_config.apiKey}");
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = (int)_config.timeoutSeconds;
            
            await request.SendWebRequest();
            
            if (request.result != UnityWebRequest.Result.Success)
            {
                throw new NoizyvoxException(request.error, request.responseCode);
            }
            
            return JsonUtility.FromJson<T>(request.downloadHandler.text);
        }
        
        private async Task<AudioClip> DownloadAudioClipAsync(string url)
        {
            AudioType audioType = _config.outputFormat switch
            {
                AudioFormat.MP3 => AudioType.MPEG,
                AudioFormat.OGG => AudioType.OGGVORBIS,
                _ => AudioType.WAV
            };
            
            using var request = UnityWebRequestMultimedia.GetAudioClip(url, audioType);
            await request.SendWebRequest();
            
            if (request.result != UnityWebRequest.Result.Success)
            {
                throw new NoizyvoxException($"Failed to download audio: {request.error}", request.responseCode);
            }
            
            return DownloadHandlerAudioClip.GetContent(request);
        }
        
        private void ValidateRequest(SynthesisRequest request)
        {
            if (string.IsNullOrEmpty(request.PersonaId))
                request.PersonaId = _config.defaultPersonaId;
                
            if (string.IsNullOrEmpty(request.PersonaId))
                throw new ArgumentException("PersonaId is required");
                
            if (string.IsNullOrEmpty(request.Text))
                throw new ArgumentException("Text is required");
        }
        
        private string GenerateCacheKey(SynthesisRequest request)
        {
            return $"{request.PersonaId}_{request.Text.GetHashCode()}_{request.Prosody?.GetHashCode() ?? 0}";
        }
        
        #endregion
        
        public void ClearCache()
        {
            foreach (var clip in _cache.Values)
            {
                if (clip != null) UnityEngine.Object.Destroy(clip);
            }
            _cache.Clear();
        }
        
        public void Dispose()
        {
            if (_disposed) return;
            ClearCache();
            _disposed = true;
        }
    }
    
    #endregion
    
    #region Data Models
    
    [Serializable]
    public class SynthesisRequest
    {
        public string PersonaId;
        public string Text;
        public bool SSML;
        public Prosody Prosody;
        public string DSPRecipe;
        public string OutputFormat;
        public bool IncludeTimestamps;
        public bool IncludeVisemes;
        public bool Watermark = true;
    }
    
    [Serializable]
    public class Prosody
    {
        [Range(0.5f, 1.5f)] public float Rate = 1.0f;
        [Range(-12f, 12f)] public float PitchSemitones = 0f;
        [Range(0f, 1f)] public float Volume = 0.8f;
        public string EmotionBlend;
    }
    
    [Serializable]
    public class SynthesisResponse
    {
        public string AudioUrl;
        public float DurationSeconds;
        public int CharactersUsed;
        public string WatermarkId;
        public List<WordTimestamp> Timestamps;
        public List<Viseme> Visemes;
        public string ManifestHash;
    }
    
    public class SynthesisResult
    {
        public AudioClip AudioClip;
        public float DurationSeconds;
        public int CharactersUsed;
        public string WatermarkId;
        public List<WordTimestamp> Timestamps;
        public List<Viseme> Visemes;
        public bool FromCache;
    }
    
    [Serializable]
    public class WordTimestamp
    {
        public string Word;
        public float StartMs;
        public float EndMs;
        public float Confidence;
    }
    
    [Serializable]
    public class Viseme
    {
        public string VisemeId;
        public float StartMs;
        public float EndMs;
        public float Weight;
    }
    
    [Serializable]
    public class AudioChunk
    {
        public byte[] Data;
        public int SampleRate;
        public int Channels;
        public float TimestampMs;
        public bool IsFinal;
    }
    
    [Serializable]
    public class PersonaSummary
    {
        public string PersonaId;
        public string DisplayName;
        public string GuildHandle;
        public List<string> ArchetypeTags;
        public List<string> GenreFit;
        public string VocalTexture;
        public string ThumbnailUrl;
        public float Rating;
        public int ReviewCount;
        public float PriceFromUsd;
    }
    
    [Serializable]
    public class PersonaPack
    {
        public PersonaIdentity Identity;
        public PersonaClassification Classification;
        public Prosody RecommendedProsody;
        public Dictionary<string, string> SSMLTemplates;
        public Dictionary<string, DSPRecipe> DSPRecipes;
        public SampleLibrary SampleLibrary;
    }
    
    [Serializable]
    public class PersonaIdentity
    {
        public string PersonaId;
        public string DisplayName;
        public string GuildHandle;
        public bool Verified;
        public string VerificationTier;
        public string AvatarUrl;
    }
    
    [Serializable]
    public class PersonaClassification
    {
        public List<string> ArchetypeTags;
        public List<string> GenreFit;
        public List<string> EmotionalRange;
        public string VocalTexture;
        public List<string> CharacterTypes;
    }
    
    [Serializable]
    public class DSPRecipe
    {
        public string ChainId;
        public string Description;
    }
    
    [Serializable]
    public class SampleLibrary
    {
        public Sample HeroReel;
        public Sample Whisper;
        public Sample Shout;
        public Sample EmotionalRange;
    }
    
    [Serializable]
    public class Sample
    {
        public string Url;
        public float DurationSeconds;
        public string Format;
    }
    
    [Serializable]
    public class LicenseUsage
    {
        public string LicenseId;
        public string Tier;
        public int RequestsUsedToday;
        public int RequestsLimitDaily;
        public int CharactersUsedMonth;
        public int CharactersLimitMonth;
        public string ExpiresAt;
    }
    
    [Serializable]
    public class PersonaFilter
    {
        public List<string> Genres;
        public List<string> Emotions;
        public string VocalTexture;
        public string Language;
        public string Tier;
        public string Sort;
        public int Page = 1;
        public int Limit = 20;
        
        public string ToQueryString()
        {
            var parts = new List<string>();
            if (Genres?.Count > 0) parts.Add($"genre={string.Join(",", Genres)}");
            if (Emotions?.Count > 0) parts.Add($"emotion={string.Join(",", Emotions)}");
            if (!string.IsNullOrEmpty(VocalTexture)) parts.Add($"texture={VocalTexture}");
            if (!string.IsNullOrEmpty(Language)) parts.Add($"language={Language}");
            if (!string.IsNullOrEmpty(Tier)) parts.Add($"tier={Tier}");
            if (!string.IsNullOrEmpty(Sort)) parts.Add($"sort={Sort}");
            parts.Add($"page={Page}");
            parts.Add($"limit={Limit}");
            return "?" + string.Join("&", parts);
        }
    }
    
    #endregion
    
    #region Exceptions
    
    public class NoizyvoxException : Exception
    {
        public long StatusCode { get; }
        
        public NoizyvoxException(string message, long statusCode = 0) : base(message)
        {
            StatusCode = statusCode;
        }
    }
    
    #endregion
    
    #region MonoBehaviour Components
    
    /// <summary>
    /// Easy-to-use component for voice synthesis
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class NoizyvoxVoice : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private NoizyvoxConfig config;
        [SerializeField] private string personaId;
        
        [Header("Prosody Settings")]
        [SerializeField] [Range(0.5f, 1.5f)] private float rate = 1.0f;
        [SerializeField] [Range(-12f, 12f)] private float pitchSemitones = 0f;
        [SerializeField] [Range(0f, 1f)] private float volume = 0.8f;
        
        [Header("DSP")]
        [SerializeField] private string dspRecipe = "studio_clean";
        
        [Header("Animation")]
        [SerializeField] private bool enableLipSync = true;
        [SerializeField] private SkinnedMeshRenderer faceMesh;
        [SerializeField] private LipSyncMapping lipSyncMapping;
        
        private NoizyvoxClient _client;
        private AudioSource _audioSource;
        private List<Viseme> _currentVisemes;
        private int _visemeIndex;
        private float _playbackStartTime;
        private bool _isPlaying;
        
        public event Action<SynthesisResult> OnSynthesisComplete;
        public event Action<string> OnSynthesisError;
        public event Action OnPlaybackStarted;
        public event Action OnPlaybackComplete;
        
        private void Awake()
        {
            _audioSource = GetComponent<AudioSource>();
            _client = new NoizyvoxClient(config);
        }
        
        private void Update()
        {
            if (_isPlaying && enableLipSync && _currentVisemes != null)
            {
                UpdateLipSync();
            }
        }
        
        /// <summary>
        /// Speak the given text
        /// </summary>
        public async void Speak(string text)
        {
            await SpeakAsync(text);
        }
        
        /// <summary>
        /// Speak the given text (async)
        /// </summary>
        public async Task SpeakAsync(string text)
        {
            try
            {
                var request = new SynthesisRequest
                {
                    PersonaId = personaId,
                    Text = text,
                    Prosody = new Prosody
                    {
                        Rate = rate,
                        PitchSemitones = pitchSemitones,
                        Volume = volume
                    },
                    DSPRecipe = dspRecipe,
                    IncludeVisemes = enableLipSync
                };
                
                var result = await _client.SynthesizeAsync(request);
                
                OnSynthesisComplete?.Invoke(result);
                
                _currentVisemes = result.Visemes;
                _visemeIndex = 0;
                
                _audioSource.clip = result.AudioClip;
                _audioSource.Play();
                
                _playbackStartTime = Time.time;
                _isPlaying = true;
                
                OnPlaybackStarted?.Invoke();
                
                // Wait for playback to complete
                await Task.Delay((int)(result.DurationSeconds * 1000));
                
                _isPlaying = false;
                OnPlaybackComplete?.Invoke();
            }
            catch (Exception ex)
            {
                OnSynthesisError?.Invoke(ex.Message);
                Debug.LogError($"[Noizyvox] Synthesis error: {ex.Message}");
            }
        }
        
        /// <summary>
        /// Stop current playback
        /// </summary>
        public void Stop()
        {
            _audioSource.Stop();
            _isPlaying = false;
            ResetLipSync();
        }
        
        private void UpdateLipSync()
        {
            if (faceMesh == null || lipSyncMapping == null || _currentVisemes == null)
                return;
                
            float currentTimeMs = (Time.time - _playbackStartTime) * 1000f;
            
            // Find current viseme
            while (_visemeIndex < _currentVisemes.Count - 1 &&
                   _currentVisemes[_visemeIndex + 1].StartMs <= currentTimeMs)
            {
                _visemeIndex++;
            }
            
            if (_visemeIndex < _currentVisemes.Count)
            {
                var viseme = _currentVisemes[_visemeIndex];
                ApplyViseme(viseme.VisemeId, viseme.Weight);
            }
        }
        
        private void ApplyViseme(string visemeId, float weight)
        {
            if (lipSyncMapping.TryGetBlendShapeIndex(visemeId, out int blendShapeIndex))
            {
                // Reset all viseme blend shapes
                foreach (var mapping in lipSyncMapping.Mappings)
                {
                    faceMesh.SetBlendShapeWeight(mapping.BlendShapeIndex, 0);
                }
                
                // Apply current viseme
                faceMesh.SetBlendShapeWeight(blendShapeIndex, weight * 100f);
            }
        }
        
        private void ResetLipSync()
        {
            if (faceMesh == null || lipSyncMapping == null) return;
            
            foreach (var mapping in lipSyncMapping.Mappings)
            {
                faceMesh.SetBlendShapeWeight(mapping.BlendShapeIndex, 0);
            }
        }
        
        private void OnDestroy()
        {
            _client?.Dispose();
        }
    }
    
    /// <summary>
    /// Mapping between viseme IDs and blend shape indices
    /// </summary>
    [CreateAssetMenu(fileName = "LipSyncMapping", menuName = "Noizyvox/Lip Sync Mapping")]
    public class LipSyncMapping : ScriptableObject
    {
        public List<VisemeBlendShapeMapping> Mappings = new List<VisemeBlendShapeMapping>();
        
        public bool TryGetBlendShapeIndex(string visemeId, out int index)
        {
            var mapping = Mappings.Find(m => m.VisemeId == visemeId);
            index = mapping?.BlendShapeIndex ?? -1;
            return index >= 0;
        }
    }
    
    [Serializable]
    public class VisemeBlendShapeMapping
    {
        public string VisemeId;      // e.g., "AA", "EE", "OH", "OO", "TH", etc.
        public int BlendShapeIndex;  // Index in SkinnedMeshRenderer
        public string Description;
    }
    
    /// <summary>
    /// Dialogue system integration
    /// </summary>
    public class NoizyvoxDialogue : MonoBehaviour
    {
        [SerializeField] private NoizyvoxVoice voice;
        [SerializeField] private DialogueData dialogueData;
        
        private int _currentLineIndex;
        private bool _isPlaying;
        
        public event Action<DialogueLine> OnLineStarted;
        public event Action<DialogueLine> OnLineComplete;
        public event Action OnDialogueComplete;
        
        public async Task PlayDialogueAsync()
        {
            _isPlaying = true;
            _currentLineIndex = 0;
            
            while (_currentLineIndex < dialogueData.Lines.Count && _isPlaying)
            {
                var line = dialogueData.Lines[_currentLineIndex];
                
                OnLineStarted?.Invoke(line);
                
                // Switch persona if needed
                if (!string.IsNullOrEmpty(line.PersonaId))
                {
                    // Set persona on voice component via reflection or public property
                }
                
                await voice.SpeakAsync(line.Text);
                
                OnLineComplete?.Invoke(line);
                
                if (line.PauseAfterMs > 0)
                {
                    await Task.Delay(line.PauseAfterMs);
                }
                
                _currentLineIndex++;
            }
            
            OnDialogueComplete?.Invoke();
        }
        
        public void Stop()
        {
            _isPlaying = false;
            voice.Stop();
        }
        
        public void Skip()
        {
            voice.Stop();
        }
    }
    
    [CreateAssetMenu(fileName = "DialogueData", menuName = "Noizyvox/Dialogue Data")]
    public class DialogueData : ScriptableObject
    {
        public List<DialogueLine> Lines = new List<DialogueLine>();
    }
    
    [Serializable]
    public class DialogueLine
    {
        public string Id;
        public string PersonaId;
        public string CharacterName;
        [TextArea(3, 10)] public string Text;
        public string Emotion;
        public int PauseAfterMs;
        public string AnimationTrigger;
    }
    
    #endregion
    
    #region WebSocket Support
    
    /// <summary>
    /// WebSocket client for streaming synthesis
    /// </summary>
    public class NoizyvoxWebSocket : IDisposable
    {
        private readonly NoizyvoxConfig _config;
        private System.Net.WebSockets.ClientWebSocket _ws;
        private bool _disposed;
        
        public NoizyvoxWebSocket(NoizyvoxConfig config)
        {
            _config = config;
            _ws = new System.Net.WebSockets.ClientWebSocket();
        }
        
        public async Task ConnectAsync(string endpoint)
        {
            string wsUrl = _config.baseUrl.Replace("https://", "wss://").Replace("http://", "ws://") + endpoint;
            _ws.Options.SetRequestHeader("Authorization", $"Bearer {_config.apiKey}");
            await _ws.ConnectAsync(new Uri(wsUrl), System.Threading.CancellationToken.None);
        }
        
        public async Task SendAsync(object data)
        {
            string json = JsonUtility.ToJson(data);
            byte[] buffer = System.Text.Encoding.UTF8.GetBytes(json);
            await _ws.SendAsync(new ArraySegment<byte>(buffer), System.Net.WebSockets.WebSocketMessageType.Text, true, System.Threading.CancellationToken.None);
        }
        
        public async IAsyncEnumerable<AudioChunk> ReceiveChunksAsync()
        {
            byte[] buffer = new byte[8192];
            
            while (_ws.State == System.Net.WebSockets.WebSocketState.Open)
            {
                var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), System.Threading.CancellationToken.None);
                
                if (result.MessageType == System.Net.WebSockets.WebSocketMessageType.Close)
                    break;
                    
                string json = System.Text.Encoding.UTF8.GetString(buffer, 0, result.Count);
                var chunk = JsonUtility.FromJson<AudioChunk>(json);
                
                yield return chunk;
                
                if (chunk.IsFinal)
                    break;
            }
        }
        
        public void Dispose()
        {
            if (_disposed) return;
            _ws?.Dispose();
            _disposed = true;
        }
    }
    
    #endregion
}

#if UNITY_EDITOR
namespace Noizyvox.Unity.Editor
{
    using UnityEditor;
    
    [CustomEditor(typeof(NoizyvoxVoice))]
    public class NoizyvoxVoiceEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();
            
            NoizyvoxVoice voice = (NoizyvoxVoice)target;
            
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("Test", EditorStyles.boldLabel);
            
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("▶ Test Voice"))
            {
                if (Application.isPlaying)
                {
                    voice.Speak("Hello, this is a test of the Noizyvox voice system.");
                }
                else
                {
                    EditorUtility.DisplayDialog("Noizyvox", "Enter Play Mode to test voice synthesis.", "OK");
                }
            }
            
            if (GUILayout.Button("⏹ Stop"))
            {
                if (Application.isPlaying)
                {
                    voice.Stop();
                }
            }
            EditorGUILayout.EndHorizontal();
        }
    }
    
    public class NoizyvoxSetupWindow : EditorWindow
    {
        private string _apiKey;
        private NoizyvoxConfig _config;
        
        [MenuItem("Noizyvox/Setup Wizard")]
        public static void ShowWindow()
        {
            GetWindow<NoizyvoxSetupWindow>("Noizyvox Setup");
        }
        
        private void OnGUI()
        {
            GUILayout.Label("🎙️ NOIZYVOX Setup", EditorStyles.boldLabel);
            EditorGUILayout.Space();
            
            _apiKey = EditorGUILayout.TextField("API Key", _apiKey);
            
            EditorGUILayout.Space();
            
            if (GUILayout.Button("Create Configuration Asset"))
            {
                CreateConfigAsset();
            }
            
            EditorGUILayout.Space();
            EditorGUILayout.HelpBox(
                "Get your API key at https://noizyvox.ai/dashboard/api-keys",
                MessageType.Info
            );
        }
        
        private void CreateConfigAsset()
        {
            _config = CreateInstance<NoizyvoxConfig>();
            _config.apiKey = _apiKey;
            
            AssetDatabase.CreateAsset(_config, "Assets/Noizyvox/NoizyvoxConfig.asset");
            AssetDatabase.SaveAssets();
            
            EditorUtility.FocusProjectWindow();
            Selection.activeObject = _config;
        }
    }
}
#endif
