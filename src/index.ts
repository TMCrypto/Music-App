import {
    $query,
    $update,
    Record,
    StableBTreeMap,
    Vec,
    match,
    Result,
    nat64,
    ic,
    Opt,
    Principal,
    int64,
  } from 'azle';
  import { v4 as uuidv4 } from 'uuid';
  
  // Define the Song record type
  type Song = Record<{
    id: string;
    fileName: string;
    mimeType: string;
    title: string;
    singers: Vec<string>;
    genre: string;
    duration: int64; // seconds
    releaseDate: string;
    uploadedAt: nat64;
  }>;
  
  // Define the payload for creating a new Song
  type SongPayload = Record<{
    fileName: string;
    mimeType: string;
    title: string;
    singers: Vec<string>;
    genre: string;
    duration: int64; // seconds
    releaseDate: string;
  }>;
  
  // Define the Playlist record type
  type Playlist = Record<{
    id: string;
    admin: Principal;
    name: string;
    description: string;
    songs: Vec<string>;
    totalDuration: int64; // seconds
    createdAt: nat64;
    updatedAt: Opt<nat64>;
  }>;
  
  // Define the payload for creating a new Playlist
  type PlaylistPayload = Record<{
    name: string;
    description: string;
  }>;
  
  // Create storage for songs and playlists
  const songsStorage = new StableBTreeMap<string, Song>(0, 44, 1024);
  const playlistsStorage = new StableBTreeMap<string, Playlist>(1, 44, 1024);
  
  const ErrMessages = {
    fieldCannotBeEmpty: (fieldName: string) => `${fieldName} cannot be empty.`,
    recordWithIdNotFound: (recordName: string, id: string) => `${recordName} with id=${id} not found.`,
    nonAdmin: (id: string) => `IC caller isn't the admin of the playlist with id ${id}.`,
    couldNotUpdate: (recordName: string, id: string) => `Couldn't update the ${recordName} with id=${id}, because the record was not found.`,
    couldNotRemove: (recordName: string, id: string) => `Couldn't remove the ${recordName} with id=${id}, because the record was not found.`,
    alreadyExists: (recordName: string) => `${recordName} already exists.`,
  };
  
  // Create a new song
  $update;
  export function uploadSong(payload: SongPayload): Result<Song, string> {
    // Function to create a new song
    
    // Validate payload fields
    if (payload.fileName === '') {
      return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty('File name'));
    }
  
    if (payload.mimeType === '') {
      return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty('File type'));
    }
  
    if (payload.title === '') {
      return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty('Title'));
    }
  
    if (payload.singers.length === 0) {
      return Result.Err<Song, string>('You must provide singer(s).');
    }
  
    // Check if a song with the same file name and title already exists
    const existingSong = songsStorage.values().find((song) => song.fileName === payload.fileName && song.title === payload.title);
  
    if (existingSong) {
      return Result.Err<Song, string>(ErrMessages.alreadyExists('Song'));
    }
  
    // Create a new Song record
    const song: Song = {
      id: uuidv4(),
      uploadedAt: ic.time(),
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      title: payload.title,
      singers: payload.singers,
      genre: payload.genre,
      duration: payload.duration,
      releaseDate: payload.releaseDate,
    };
  
    try {
      // Insert the new song into storage
      songsStorage.insert(song.id, song);
    } catch (error) {
      console.error(error);
      return Result.Err<Song, string>(`Error inserting a song into the storage: ${error}`);
    }
  
    return Result.Ok(song);
  }
  
  // Create a new playlist
  $update;
  export function createPlaylist(payload: PlaylistPayload): Result<Playlist, string> {
    // Function to create a new playlist
    
    // Validate payload fields
    if (!payload.name || !payload.description) {
      return Result.Err<Playlist, string>(`Payload must include 'name' and 'description' properties.`);
    }
  
    if (payload.name === '') {
      return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Playlist name'));
    }
  
    if (payload.description === '') {
      return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Playlist description'));
    }
  
    // Check if a playlist with the same name already exists
    const existingPlaylist = playlistsStorage.values().find((playlist) => playlist.name === payload.name);
  
    if (existingPlaylist) {
      return Result.Err<Playlist, string>(ErrMessages.alreadyExists('Playlist'));
    }
  
    try {
      // Create a new Playlist record
      const playlist: Playlist = {
        id: uuidv4(),
        admin: ic.caller(),
        songs: [],
        totalDuration: BigInt(0),
        createdAt: ic.time(),
        updatedAt: Opt.None,
        name: payload.name,
        description: payload.description,
      };
  
      // Insert the new playlist into storage
      playlistsStorage.insert(playlist.id, playlist);
      return Result.Ok(playlist);
    } catch (error) {
      return Result.Err<Playlist, string>(`Error inserting the ${payload.name} playlist. Please try again.`);
    }
  }
  
  // Read
  $query;
  export function getSong(id: string): Result<Song, string> {
    // Function to retrieve a song by ID
    
    try {
      // Validate the song ID
      if (id === '') {
        return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty('Song id'));
      }
  
      return match(songsStorage.get(id), {
        Some: (song) => Result.Ok<Song, string>(song),
        None: () => Result.Err<Song, string>(ErrMessages.recordWithIdNotFound('Song', id)),
      });
    } catch (error) {
      return Result.Err<Song, string>(`Error while fetching song with id ${id}`);
    }
  }
  
  $query;
  export function getSongs(): Result<Vec<Song>, string> {
    // Function to retrieve all songs
    try {
      return Result.Ok(songsStorage.values());
    } catch (error) {
      return Result.Err(`Error retrieving songs: ${error}`);
    }
  }
  
  $query;
  export function getPlaylist(id: string): Result<Playlist, string> {
    // Function to retrieve a playlist by ID
    try {
      // Validate the playlist ID
      if (id === '') {
        return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Playlist id'));
      }
  
      return match(playlistsStorage.get(id), {
        Some: (playlist) => Result.Ok<Playlist, string>(playlist),
        None: () => Result.Err<Playlist, string>(ErrMessages.recordWithIdNotFound('Playlist', id)),
      });
    } catch (error) {
      return Result.Err<Playlist, string>(`Error while fetching playlist with id ${id}`);
    }
  }
  
  $query;
  export function getPlaylists(): Result<Vec<Playlist>, string> {
    // Function to retrieve all playlists
    try {
      return Result.Ok(playlistsStorage.values());
    } catch (error) {
      return Result.Err(`Error retrieving playlists: ${error}`);
    }
  }
  
  // Update
  $update;
  export function updatePlaylist(id: string, payload: PlaylistPayload): Result<Playlist, string> {
    // Function to update a playlist by ID
    
    // Validate payload fields
    if (!payload.name || !payload.description || payload.name.trim() === '' || payload.description.trim() === '') {
      return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('name or description'));
    }
  
    return match(playlistsStorage.get(id), {
      Some: (playlist) => {
        // Check if the caller is the admin of the playlist
        if (playlist.admin.toString() !== ic.caller().toString()) {
          return Result.Err<Playlist, string>(ErrMessages.nonAdmin(id));
        }
  
        // Create an updated Playlist record
        const updatedPlaylist: Playlist = { ...playlist, name: payload.name, description: payload.description, updatedAt: Opt.Some(ic.time()) };
  
        try {
          // Insert the updated playlist into storage
          playlistsStorage.insert(playlist.id, updatedPlaylist);
          return Result.Ok<Playlist, string>(updatedPlaylist);
        } catch (error) {
          return Result.Err<Playlist, string>(`Error inserting the updated playlist into the playlistsStorage`);
        }
      },
      None: () => Result.Err<Playlist, string>(ErrMessages.couldNotUpdate('playlist', id)),
    });
  }
  
  $update;
  export function addSongsToPlaylist(id: string, songs: Vec<string>): Result<Playlist, string> {
    // Function to add songs to a playlist by ID
    
    if (songs.length === 0) {
      return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Song list'));
    }
  
    return match(playlistsStorage.get(id), {
      Some: (playlist) => {
        // Check if the caller is the admin of the playlist
        if (playlist.admin.toString() !== ic.caller().toString()) {
          return Result.Err<Playlist, string>(ErrMessages.nonAdmin(id));
        }
  
        // Create an updated Playlist record
        const updatedPlaylist: Playlist = { ...playlist, updatedAt: Opt.Some(ic.time()) };
  
        let addFlag = false;
        songs.forEach((songId) => {
          const existingSong = songsStorage.get(songId);
          if (existingSong && existingSong.Some) {
            const duplicatedSong = updatedPlaylist.songs.find((id) => id === songId);
            if (!duplicatedSong) {
              updatedPlaylist.songs.push(songId);
              updatedPlaylist.totalDuration += existingSong.Some.duration;
              addFlag = true;
            }
          }
        });
  
        if (!addFlag) {
          return Result.Err<Playlist, string>('Unable to find the songs you wanted to add or they all already exist.');
        }
  
        // Insert the updated playlist into storage
        playlistsStorage.insert(playlist.id, updatedPlaylist);
        return Result.Ok<Playlist, string>(updatedPlaylist);
      },
      None: () => Result.Err<Playlist, string>(ErrMessages.couldNotUpdate('playlist', id)),
    });
  }
  
  // Delete
  $update;
  export function deletePlaylist(id: string): Result<Playlist, string> {
    // Function to delete a playlist by ID
    return match(playlistsStorage.get(id), {
      Some: (playlist) => {
        // Check if the caller is the admin of the playlist
        if (playlist.admin.toString() !== ic.caller().toString()) {
          return Result.Err<Playlist, string>(ErrMessages.nonAdmin(id));
        }
  
        // Remove the playlist from storage
        playlistsStorage.remove(id);
        return Result.Ok<Playlist, string>(playlist);
      },
      None: () => Result.Err<Playlist, string>(ErrMessages.couldNotRemove('playlist', id)),
    });
  }
  
  $update;
  export function deleteSongFromPlaylist(playlistId: string, songId: string): Result<Playlist, string> {
    // Function to delete a song from a playlist by ID
    if (playlistId === '') {
      return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Playlist id'));
    }
  
    if (songId === '') {
      return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Song id'));
    }
  
    return match(playlistsStorage.get(playlistId), {
      Some: (playlist) => {
        // Check if the caller is the admin of the playlist
        if (playlist.admin.toString() !== ic.caller().toString()) {
          return Result.Err<Playlist, string>(ErrMessages.nonAdmin(playlistId));
        }
  
        const updatedPlaylist: Playlist = { ...playlist };
        const songIndex = updatedPlaylist.songs.findIndex((id) => id === songId);
        if (songIndex !== -1) {
          const deletingSong = songsStorage.get(songId).Some;
          if (deletingSong && updatedPlaylist.totalDuration - deletingSong.duration >= 0)
            updatedPlaylist.totalDuration -= deletingSong.duration;
          else
            updatedPlaylist.totalDuration = BigInt(0);
  
          updatedPlaylist.songs.splice(songIndex, 1);
          updatedPlaylist.updatedAt = Opt.Some(ic.time());
          playlistsStorage.insert(playlist.id, updatedPlaylist);
        }
  
        return Result.Ok<Playlist, string>(updatedPlaylist);
      },
      None: () => Result.Err<Playlist, string>(ErrMessages.couldNotRemove('playlist', playlistId)),
    });
  }
  
  // A workaround to make uuid package work with Azle
  globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
      let array = new Uint8Array(32);
  
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
  
      return array;
    },
  };
  