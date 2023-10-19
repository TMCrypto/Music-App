import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal, int64 } from 'azle';
import { v4 as uuidv4 } from 'uuid';

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
}>

type SongPayload = Record<{
    fileName: string;
    mimeType: string;
    title: string;
    singers: Vec<string>;
    genre: string;
    duration: int64; // seconds
    releaseDate: string;
}>

type Playlist = Record<{
    id: string;
    admin: Principal;
    name: string;
    description: string;
    songs: Vec<string>;
    totalDuration: int64; // seconds
    createdAt: nat64;
    updatedAt: Opt<nat64>;
}>

type PlaylistPayload = Record <{
    name: string;
    description: string;
}>

const songsStorage = new StableBTreeMap<string, Song>(0, 44, 1024);
const playlistsStorage = new StableBTreeMap<string, Playlist>(1, 44, 1024);

const ErrMessages = {
    fieldCannotBeEmpty: (fieldName: string) => `${fieldName} cannot be empty.`,
    recordWithIdNotFound: (recordName: string, id: string) => `${recordName} with id=${id} not found.`,
    nonAdmin: (id: string) => `IC caller isn't the admin of the playlist with id ${id}.`,
    couldNotUpdate: (recordName: string, id: string) => `Couldn't update the ${recordName} with id=${id}, because record not found.`,
    couldNotRemove: (recordName: string, id: string) => `Couldn't remove the ${recordName} with id=${id}, because record not found.`,
    alreadyExists: (recordName: string) => `${recordName} already exists.`
}

// Create
$update;
export function uploadSong(payload: SongPayload): Result<Song, string> {
    if (payload.fileName === "") {
        return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty("File name"));
    }

    if (payload.mimeType === "") {
        return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty("File type"));
    }

    if (payload.title === "") {
        return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty("Title"));
    }

    if (payload.singers.length === 0) {
        return Result.Err<Song, string>("You must provide singer(s).");
    }

    const existingSong = songsStorage
        .values()
        .find((song) => song.fileName === payload.fileName && song.title === payload.title);

    if (existingSong) {
        return Result.Err<Song, string>(ErrMessages.alreadyExists("Song"));
    }
    
    const song: Song = { id: uuidv4(), uploadedAt: ic.time(), ...payload };
    
    try {
        songsStorage.insert(song.id, song);
    } catch (error) {
        return Result.Err<Song, string>("Error inserting a song into the storage.");
    }

    return Result.Ok(song);
}

$update;
export function createPlaylist(payload: PlaylistPayload): Result<Playlist, string> {
    if (payload.name === "") {
        return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty("Playlist name"));
    }

    const existingPlaylist = playlistsStorage
        .values()
        .find((playlist) => playlist.name === payload.name);

    if (existingPlaylist) {
        return Result.Err<Playlist, string>(ErrMessages.alreadyExists("Playlist"));
    }

    const playlist: Playlist = {
        id: uuidv4(),
        admin: ic.caller(),
        songs: [],
        totalDuration: BigInt(0),
        createdAt: ic.time(),
        updatedAt: Opt.None,
        ...payload
    };

    try {
        playlistsStorage.insert(playlist.id, playlist);
    } catch (error) {
        return Result.Err<Playlist, string>(`Error inserting your ${payload.name} playlist. Please try again.`);
    }

    return Result.Ok(playlist);
}

// Read
$query;
export function getSong(id: string): Result<Song, string> {
    if (id === "") {
        return Result.Err<Song, string>(ErrMessages.fieldCannotBeEmpty("Song id"));
    }

    return match(songsStorage.get(id), {
        Some: (song) => Result.Ok<Song, string>(song),
        None: () => Result.Err<Song, string>(ErrMessages.recordWithIdNotFound("Song", id))
    });
}

$query;
export function getSongs(): Result<Vec<Song>, string> {
    return Result.Ok(songsStorage.values());
}

$query;
export function getPlaylist(id: string): Result<Playlist, string> {
    if (id === "") {
        return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty("Playlist id"));
    }

    return match(playlistsStorage.get(id), {
        Some: (playlist) => Result.Ok<Playlist, string>(playlist),
        None: () => Result.Err<Playlist, string>(ErrMessages.recordWithIdNotFound("Playlist", id))
    });
}

$query;
export function getPlaylists(): Result<Vec<Playlist>, string> {
    return Result.Ok(playlistsStorage.values());
}

// Update
$update;
export function updatePlaylist(id: string, payload: PlaylistPayload): Result<Playlist, string> {
    return match(playlistsStorage.get(id), {
        Some: (playlist) => {
            if (playlist.admin.toString() !== ic.caller().toString()) {
                return Result.Err<Playlist,string>(ErrMessages.nonAdmin(id));
            }

            const updatedPlaylist: Playlist = {...playlist, ...payload, updatedAt: Opt.Some(ic.time())};

            playlistsStorage.insert(playlist.id, updatedPlaylist);
            return Result.Ok<Playlist, string>(updatedPlaylist);
        },
        None: () => Result.Err<Playlist, string>(ErrMessages.couldNotUpdate('playlist', id))
    });
}

$update;
export function addSongsToPlaylist(id: string, songs: Vec<string>): Result<Playlist, string> {
    if (songs.length === 0) {
        return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Song list'));
    }

    return match(playlistsStorage.get(id), {
        Some: (playlist) => {
            if (playlist.admin.toString() !== ic.caller().toString()) {
                return Result.Err<Playlist,string>(ErrMessages.nonAdmin(id));
            }

            const updatedPlaylist: Playlist = {...playlist, updatedAt: Opt.Some(ic.time())};

            let addFlag = false;
            songs.forEach(songId => {
                const existingSong = songsStorage.get(songId);
                if (existingSong && existingSong.Some) {
                    const duplicatedSong = updatedPlaylist.songs.find(id => id === songId);
                    if (!duplicatedSong) {
                        updatedPlaylist.songs.push(songId);
                        updatedPlaylist.totalDuration += existingSong.Some.duration;
                        addFlag = true;
                    }
                }
            })

            if (!addFlag) {
                return Result.Err<Playlist, string>('Unable to find the songs you wanted to add or they all already exist.');
            }

            playlistsStorage.insert(playlist.id, updatedPlaylist);
            return Result.Ok<Playlist, string>(updatedPlaylist);
        },
        None: () => Result.Err<Playlist, string>(ErrMessages.couldNotUpdate('playlist', id))
    });
}

// Delete
$update;
export function deletePlaylist(id: string): Result<Playlist, string> {
    return match(playlistsStorage.get(id), {
        Some: (playlist) => {
            if (playlist.admin.toString() !== ic.caller().toString()) {
                return Result.Err<Playlist,string>(ErrMessages.nonAdmin(id));
            }

            playlistsStorage.remove(id);
            return Result.Ok<Playlist, string>(playlist);
        },
        None: () => Result.Err<Playlist, string>(ErrMessages.couldNotRemove('playlist', id))
    });
}

$update;
export function deleteSongFromPlaylist(playlistId: string, songId: string): Result<Playlist, string> {
    if (playlistId === "") {
        return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Playlist id'));
    }

    if (songId === "") {
        return Result.Err<Playlist, string>(ErrMessages.fieldCannotBeEmpty('Song id'));
    }

    return match(playlistsStorage.get(playlistId), {
        Some: (playlist) => {
            if (playlist.admin.toString() !== ic.caller().toString()) {
                return Result.Err<Playlist,string>(ErrMessages.nonAdmin(playlistId));
            }

            const updatedPlaylist: Playlist = {...playlist};
            const songIndex = updatedPlaylist.songs.findIndex(id => id === songId);
            if (songIndex != -1) {
                const deletingSong = songsStorage.get(songId).Some;
                if (deletingSong && updatedPlaylist.totalDuration - deletingSong.duration >= 0)
                    updatedPlaylist.totalDuration -= deletingSong.duration;
                else
                    updatedPlaylist.totalDuration = BigInt(0);

                updatedPlaylist.songs.splice(songIndex, 1);
                updatedPlaylist.updatedAt = Opt.Some(ic.time());
                playlistsStorage.insert(playlist.id, updatedPlaylist)
            }

            return Result.Ok<Playlist, string>(updatedPlaylist);
        },
        None: () => Result.Err<Playlist, string>(ErrMessages.couldNotRemove('playlist', playlistId))
    });
}

// Function 1: Get songs by genre
$query;
export function getSongsByGenre(genre: string): Result<Vec<Song>, string> {
    return Result.Ok(songsStorage
        .values()
        .filter(song => song.genre === genre)
    );
}

// Function 2: Update song information
$update;
export function updateSong(id: string, payload: SongPayload): Result<Song, string> {
    return match(songsStorage.get(id), {
        Some: (song) => {
            // Check if the caller is authorized to update the song (e.g., admin or owner check)
            // Add your authorization logic here.
            const updatedSong: Song = { ...song, ...payload };
            songsStorage.insert(id, updatedSong);
            return Result.Ok<Song, string>(updatedSong);
        },
        None: () => Result.Err<Song, string>(ErrMessages.couldNotUpdate('song', id))
    });
}

// Function 3: Get songs by singer
$query;
export function getSongsBySinger(singer: string): Result<Vec<Song>, string> {
    return Result.Ok(songsStorage
        .values()
        .filter(song => song.singers.includes(singer))
    );
}

// Function 4: Get playlists by admin
$query;
export function getPlaylistsByAdmin(admin: Principal): Result<Vec<Playlist>, string> {
    return Result.Ok(playlistsStorage
        .values()
        .filter(playlist => playlist.admin.toString() === admin.toString())
    );
}

// Function 5: Get playlist songs
$query;
export function getPlaylistSongs(id: string): Result<Vec<Song>, string> {
    return match(playlistsStorage.get(id), {
        Some: (playlist) => {
            const songIds = playlist.songs;
            const playlistSongs = songIds.map(songId => songsStorage.get(songId).Some);
            return Result.Ok(playlistSongs);
        },
        None: () => Result.Err<Playlist, string>(ErrMessages.recordWithIdNotFound('Playlist', id))
    });
}

// Function 6: Get the total duration of a playlist
$query;
export function getPlaylistTotalDuration(id: string): Result<int64, string> {
    return match(playlistsStorage.get(id), {
        Some: (playlist) => Result.Ok(playlist.totalDuration),
        None: () => Result.Err<Playlist, string>(ErrMessages.recordWithIdNotFound('Playlist', id))
    });
}

// Function 7: Get the number of songs in a playlist
$query;
export function getPlaylistSongCount(id: string): Result<int64, string> {
    return match(playlistsStorage.get(id), {
        Some: (playlist) => Result.Ok(int64(playlist.songs.length)),
        None: () => Result.Err<Playlist, string>(ErrMessages.recordWithIdNotFound('Playlist', id))
    });
}

// Function 8: Get the list of playlists by genre
$query;
export function getPlaylistsByGenre(genre: string): Result<Vec<Playlist>, string> {
    return Result.Ok(playlistsStorage
        .values()
        .filter(playlist => {
            const playlistSongs = playlist.songs.map(songId => songsStorage.get(songId).Some);
            return playlistSongs.some(song => song.genre === genre);
        })
    );
}

// A workaround to make uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32)

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256)
        }

        return array
    }
}
