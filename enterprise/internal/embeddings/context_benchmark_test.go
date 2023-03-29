package embeddings

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/sourcegraph/sourcegraph/internal/endpoint"
)

func TestContextFetching(t *testing.T) {
	client := NewClient()
	client.Endpoints = endpoint.Static("http://localhost:9991")

	count, recall1, recall5, recall10 := 0.0, 0.0, 0.0, 0.0

	file, err := os.Open("testdata/context_data.tsv")
	if err != nil {
		t.Fatal(err)
	}

	scanner := bufio.NewScanner(file)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		line := scanner.Text()

		fields := strings.Split(line, "\t")
		query := fields[0]
		relevantFile := fields[1]

		search := EmbeddingsSearchParameters{
			RepoName:         "github.com/sourcegraph/sourcegraph",
			Query:            query,
			CodeResultsCount: 10,
			TextResultsCount: 0}

		results, err := client.Search(context.Background(), search)
		if err != nil {
			t.Fatal(err)
		}

		fmt.Println("Query:", query)
		fmt.Println("Results:")

		pos := 1000
		for i, result := range results.CodeResults {
			if result.FileName == relevantFile {
				pos = i
				fmt.Printf(">> %d. %s\n", i+1, result.FileName)
			} else {
				fmt.Printf("   %d. %s\n", i+1, result.FileName)
			}
		}
		fmt.Println()

		count++
		if pos < 1 {
			recall1++
		}
		if pos < 5 {
			recall5++
		}
		if pos < 10 {
			recall10++
		}
	}

	fmt.Println()
	fmt.Printf("Recall@1:  %f\n", recall1/count)
	fmt.Printf("Recall@5:  %f\n", recall5/count)
	fmt.Printf("Recall@10: %f\n", recall10/count)
}
