const fs = require('fs');
const { parse } = require('csv-parse');
const { createObjectCsvWriter } = require('csv-writer');

// 1. Odczytaj dane z pliku
function readFile(inputFile, encoding, startFlag, stopFlag) {
    return new Promise((resolve, reject) => {
        const dataRows = [];
        let startReading = false;
        let stopReading = false;

        fs.createReadStream(inputFile, { encoding })
            .pipe(parse({
                delimiter: '\t',
                trim: true,
                relax_column_count: true,
            }))
            .on('data', (row) => {
                // Zatrzymaj odczyt, gdy linia zawiera flagę
                if (stopReading) return;

                // Sprawdź, czy odczyt zaczyna się od linii zawierającej flagę
                if (!startReading) {
                    if (Object.values(row).some(value => value.includes(startFlag))) {
                        startReading = true;
                    }
                    return;
                }
                // Sprawdź, czy linia zawiera flagę końcową, aby zatrzymać odczyt
                if (Object.values(row).some(value => value.includes(stopFlag))) {
                    stopReading = true;
                    return;
                }
                dataRows.push(row);
            })
            .on('end', () => {
                console.log('Odczytano dane:', dataRows.length, 'wierszy');
                resolve(dataRows);
            })
            .on('error', (err) => {
                console.error('Błąd podczas odczytu pliku:', err);
                reject(err);
            });
    });
}

// 2. Rozdziel sekcje na wiersze i kolumny
function processRows(dataRows) {
    const participants = [];
    let headersSet = false;
    let headers = [];

    for (const row of dataRows) {
        // Ignoruj wiersze, które są całkowicie puste
        if (Object.values(row).every(value => !value)) continue;

        // Nagłówki na podstawie 1 wiersza
        if (!headersSet) {
            headers = Object.values(row);
            headersSet = true;
            continue;
        }

        const rowData = {};
        headers.forEach((header, index) => {
            rowData[header] = Object.values(row)[index] || '';
        });


        const fullName = rowData['Imię i nazwisko'];
        const duration = rowData['Czas udziału w spotkaniu'];

        if (!fullName || !duration) {
            console.warn('Brakujące dane w wierszu:', rowData);
            return;
        }
        
        let [firstName, lastName] = fullName.split(' ');
        if (!firstName) firstName = ''; //Przypisz pustą wartość dla imienia gdy nie jest ono określone
        if (!lastName) {    //Przypisz wartość imienia polu lastname gdy nie jest ono określone
            lastName = firstName;
            firstName = '';
        }

        participants.push({ firstName, lastName, duration });
    }
    return participants;
}


// 3. Posortuj wiersze według kolumny 'nazwisko'
function sortByLastName(participants) {
    return participants.sort((a, b) => a.lastName.localeCompare(b.lastName));
}

// 4. Określ, czy należy się zaświadczenie za udział w spotkaniu (min 60 minut)
function determineCertificateEligibility(participants) {
    return participants.map(({ firstName, lastName, duration }) => {
        const hasCertificate = /\b([1-9]\d*) godz/.test(duration) ? 'Tak' : 'Nie'; // Sprawdź, czy przed 'godz' znajduje się liczba >=1
        return {
            Nazwisko: lastName,
            Imię: firstName,
            Status_zaświadczenia: hasCertificate,
            Czas_uczestnictwa: duration,
        };
    });
}

// 5. Zapisz do pliku CSV
async function saveToCSV(participants, outputFile) {
    const csvWriter = createObjectCsvWriter({
        path: outputFile,
        header: [
            { id: 'Nazwisko', title: 'Nazwisko' },
            { id: 'Imię', title: 'Imię' },
            { id: 'Status_zaświadczenia', title: 'Status zaświadczenia' },
            { id: 'Czas_uczestnictwa', title: 'Czas uczestnictwa' },
        ],
    });
    try {
        await csvWriter.writeRecords(participants);
        console.log('Plik CSV został zapisany jako: ', outputFile);
    } catch (err) {
        console.error('Błąd podczas zapisywania pliku CSV:', err);
    }
}

// Główna funkcja uruchamiająca procesy
async function processFile() {
    const inputFile = '5TP_Zadanie programistyczne pod INF.04 - Raport obecności 6-09-24 (5TP).csv';
    const outputFile = 'KLASA_Zadanie-INF04.csv';
    const encoding = 'utf16le';
    const startFlag = "2. Uczestnicy";
    const stopFlag = "3. Działania podczas spotkania";

    try {
        const dataRows = await readFile(inputFile, encoding, startFlag, stopFlag);
        const participantsRaw = processRows(dataRows);
        const sortedParticipants = sortByLastName(participantsRaw);
        const participantsWithCertificates = determineCertificateEligibility(sortedParticipants);
        await saveToCSV(participantsWithCertificates, outputFile);
    } catch (error) {
        console.error('Błąd podczas przetwarzania pliku:', error);
    }
}
// Uruchomienie procesu
processFile();
